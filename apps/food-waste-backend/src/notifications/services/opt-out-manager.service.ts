import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';

import { LeanDocument } from '../../common/types/mongoose.types';
import {
  OptOutRequestDto,
  OptInRequestDto,
  BulkOptOutCheckDto,
  OptOutQueryDto,
  OptOutStatusResponseDto,
  BulkOptOutStatusResponseDto,
  OptOutListResponseDto,
  OptOutOperationResponseDto,
  IOptOutMetadata,
  IMessageStats,
} from '../dto/opt-out.dto';
import {
  OptOutRecord,
  OptOutRecordDocument,
  OptOutReason,
  OptOutScope,
  OptOutStatus as OptOutRecordStatus,
} from '../schemas/opt-out-record.schema';

import { PhoneValidatorService } from './phone-validator.service';

@Injectable()
export class OptOutManagerService {
  private readonly logger = new Logger(OptOutManagerService.name);
  private readonly defaultExpirationDays: number;
  private readonly maxBulkSize: number;
  private readonly rateLimitWindow: number;
  private readonly maxRetries: number;

  constructor(
    @InjectModel(OptOutRecord.name) private readonly optOutModel: Model<OptOutRecordDocument>,
    private readonly phoneValidator: PhoneValidatorService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.defaultExpirationDays = this.configService.get<number>(
      'sms.optOut.defaultExpirationDays',
      365,
    );
    this.maxBulkSize = this.configService.get<number>('sms.optOut.maxBulkSize', 1000);
    this.rateLimitWindow = this.configService.get<number>('sms.optOut.rateLimitWindow', 60000);
    this.maxRetries = this.configService.get<number>('sms.optOut.maxRetries', 3);
    void this.rateLimitWindow;
    void this.maxRetries;
  }

  async checkOptOutStatus(
    phoneNumber: string,
    includeAuditLog: boolean = false,
    includeStats: boolean = false,
  ): Promise<OptOutStatusResponseDto> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const sanitized = this.phoneValidator.sanitizePhoneNumber(phoneNumber);

      if (!this.phoneValidator.validatePhoneNumber(sanitized)) {
        this.logger.warn(
          `Invalid phone number format attempted: ${this.phoneValidator.maskPhoneNumber(phoneNumber)}`,
          {
            operationId,
            phoneNumber: this.phoneValidator.maskPhoneNumber(phoneNumber),
          },
        );
        throw new BadRequestException('Invalid phone number format - must be in E.164 format');
      }

      const record = await this.optOutModel
        .findOne({
          phoneNumber: sanitized,
          status: { $ne: OptOutRecordStatus.REVOKED },
        })
        .lean()
        .exec();

      if (!record) {
        this.logger.debug(`No opt-out record found for phone number`, {
          operationId,
          phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
          processingTimeMs: Date.now() - startTime,
        });

        return {
          phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
          isOptedOut: false,
          status: OptOutRecordStatus.ACTIVE,
          scope: OptOutScope.ALL_SMS,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Check if record is expired
      const isExpired = record.expiresAt ? new Date() > record.expiresAt : false;
      if (isExpired && record.status !== OptOutRecordStatus.EXPIRED) {
        await this.optOutModel.updateOne(
          { _id: record._id },
          {
            status: OptOutRecordStatus.EXPIRED,
            isOptedOut: false,
            $push: {
              auditLog: {
                action: 'expired',
                timestamp: new Date(),
                reason: 'Record automatically expired',
                metadata: { operationId },
              },
            },
          },
        );

        this.logger.warn(`Opt-out record expired and updated`, {
          operationId,
          phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
          recordId: record._id.toString(),
        });
      }

      const response: OptOutStatusResponseDto = {
        phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        isOptedOut: isExpired ? false : record.isOptedOut,
        status: isExpired ? OptOutRecordStatus.EXPIRED : record.status,
        scope: record.scope,
        optedOutAt: record.optedOutAt,
        optedInAt: record.optedInAt,
        reason: record.reason,
        expiresAt: record.expiresAt,
        isExpired,
        userId: record.userId?.toString(),
        source: record.source,
        metadata: record.metadata,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };

      if (includeAuditLog) {
        response.auditLog = record.auditLog;
      }

      if (includeStats) {
        response.messageStats = record.messageStats as IMessageStats | undefined;
      }

      this.logger.debug(`Opt-out status checked successfully`, {
        operationId,
        phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        isOptedOut: response.isOptedOut,
        status: response.status,
        processingTimeMs: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to check opt-out status`, {
        operationId,
        phoneNumber: this.phoneValidator.maskPhoneNumber(phoneNumber),
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTimeMs: Date.now() - startTime,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to check opt-out status');
    }
  }

  async handleOptOut(optOutRequest: OptOutRequestDto): Promise<OptOutOperationResponseDto> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const sanitized = this.phoneValidator.sanitizePhoneNumber(optOutRequest.phoneNumber);

      if (!this.phoneValidator.validatePhoneNumber(sanitized)) {
        this.logger.warn(`Invalid phone number format for opt-out`, {
          operationId,
          phoneNumber: this.phoneValidator.maskPhoneNumber(optOutRequest.phoneNumber),
        });
        throw new BadRequestException('Invalid phone number format - must be in E.164 format');
      }

      // Calculate expiration date if not provided
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.defaultExpirationDays);

      // Prepare metadata
      const metadata: IOptOutMetadata = {
        ...optOutRequest.metadata,
        operationId,
        requestTimestamp: new Date().toISOString(),
      };

      const updateData = {
        phoneNumber: sanitized,
        isOptedOut: true,
        status: OptOutRecordStatus.ACTIVE,
        scope: optOutRequest.scope || OptOutScope.ALL_SMS,
        reason: optOutRequest.reason || OptOutReason.USER_REQUESTED,
        optedOutAt: new Date(),
        optedInAt: undefined,
        expiresAt,
        userId: optOutRequest.userId ? new Types.ObjectId(optOutRequest.userId) : undefined,
        ipAddress: optOutRequest.ipAddress,
        userAgent: optOutRequest.userAgent,
        source: optOutRequest.source,
        metadata,
        lastVerifiedAt: new Date(),
        isVerified: true,
        retryCount: 0,
        $push: {
          auditLog: {
            action: 'opt_out',
            timestamp: new Date(),
            reason: optOutRequest.reason || OptOutReason.USER_REQUESTED,
            userId: optOutRequest.userId ? new Types.ObjectId(optOutRequest.userId) : undefined,
            ipAddress: optOutRequest.ipAddress,
            userAgent: optOutRequest.userAgent,
            metadata: { operationId, source: optOutRequest.source },
          },
        },
      };

      const result = await this.optOutModel
        .findOneAndUpdate({ phoneNumber: sanitized }, updateData, {
          upsert: true,
          new: true,
          runValidators: true,
        })
        .exec();

      // Emit event for downstream processing
      this.eventEmitter.emit('sms.opt-out.processed', {
        phoneNumber: sanitized,
        userId: optOutRequest.userId,
        reason: optOutRequest.reason,
        scope: optOutRequest.scope,
        recordId: result._id.toString(),
        operationId,
      });

      const response: OptOutOperationResponseDto = {
        success: true,
        message: 'Phone number successfully opted out from SMS notifications',
        phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        details: {
          previousStatus: false, // We could check this from existing record
          newStatus: true,
          reason: optOutRequest.reason || OptOutReason.USER_REQUESTED,
          scope: optOutRequest.scope || OptOutScope.ALL_SMS,
          recordId: result._id.toString(),
        },
        timestamp: new Date(),
        operationId,
      };

      this.logger.warn(`Opt-out processed successfully`, {
        operationId,
        phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        reason: optOutRequest.reason,
        scope: optOutRequest.scope,
        userId: optOutRequest.userId,
        recordId: result._id.toString(),
        processingTimeMs: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to process opt-out`, {
        operationId,
        phoneNumber: this.phoneValidator.maskPhoneNumber(optOutRequest.phoneNumber),
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTimeMs: Date.now() - startTime,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process opt-out request');
    }
  }

  async handleOptIn(optInRequest: OptInRequestDto): Promise<OptOutOperationResponseDto> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const sanitized = this.phoneValidator.sanitizePhoneNumber(optInRequest.phoneNumber);

      if (!this.phoneValidator.validatePhoneNumber(sanitized)) {
        this.logger.warn(`Invalid phone number format for opt-in`, {
          operationId,
          phoneNumber: this.phoneValidator.maskPhoneNumber(optInRequest.phoneNumber),
        });
        throw new BadRequestException('Invalid phone number format - must be in E.164 format');
      }

      // Check if record exists
      const existingRecord = await this.optOutModel.findOne({ phoneNumber: sanitized }).exec();

      if (!existingRecord) {
        this.logger.warn(`Attempted to opt-in non-existent record`, {
          operationId,
          phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        });
        throw new NotFoundException('No opt-out record found for this phone number');
      }

      if (!existingRecord.isOptedOut) {
        this.logger.warn(`Phone number already opted in`, {
          operationId,
          phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        });

        return {
          success: true,
          message: 'Phone number is already opted in for SMS notifications',
          phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
          details: {
            previousStatus: false,
            newStatus: false,
            reason: OptOutReason.USER_REQUESTED,
            scope: existingRecord.scope,
            recordId: existingRecord._id.toString(),
          },
          timestamp: new Date(),
          operationId,
        };
      }

      // Prepare metadata
      const metadata: IOptOutMetadata = {
        ...optInRequest.metadata,
        operationId,
        requestTimestamp: new Date().toISOString(),
        previousOptOutReason: existingRecord.reason,
      };

      const result = await this.optOutModel
        .findOneAndUpdate(
          { phoneNumber: sanitized },
          {
            isOptedOut: false,
            status: OptOutRecordStatus.ACTIVE,
            optedInAt: new Date(),
            expiresAt: undefined, // Clear expiration when opting back in
            userId: optInRequest.userId
              ? new Types.ObjectId(optInRequest.userId)
              : existingRecord.userId,
            ipAddress: optInRequest.ipAddress,
            userAgent: optInRequest.userAgent,
            source: optInRequest.source,
            metadata,
            lastVerifiedAt: new Date(),
            isVerified: true,
            $push: {
              auditLog: {
                action: 'opt_in',
                timestamp: new Date(),
                reason: 'User requested opt-in',
                userId: optInRequest.userId ? new Types.ObjectId(optInRequest.userId) : undefined,
                ipAddress: optInRequest.ipAddress,
                userAgent: optInRequest.userAgent,
                metadata: { operationId, source: optInRequest.source },
              },
            },
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (!result) {
        throw new InternalServerErrorException('Failed to update opt-in status');
      }

      // Emit event for downstream processing
      this.eventEmitter.emit('sms.opt-in.processed', {
        phoneNumber: sanitized,
        userId: optInRequest.userId,
        previousReason: existingRecord.reason,
        recordId: result._id.toString(),
        operationId,
      });

      const response: OptOutOperationResponseDto = {
        success: true,
        message: 'Phone number successfully opted in for SMS notifications',
        phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        details: {
          previousStatus: true,
          newStatus: false,
          reason: OptOutReason.USER_REQUESTED,
          scope: result.scope,
          recordId: result._id.toString(),
        },
        timestamp: new Date(),
        operationId,
      };

      this.logger.warn(`Opt-in processed successfully`, {
        operationId,
        phoneNumber: this.phoneValidator.maskPhoneNumber(sanitized),
        userId: optInRequest.userId,
        recordId: result._id.toString(),
        processingTimeMs: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to process opt-in`, {
        operationId,
        phoneNumber: this.phoneValidator.maskPhoneNumber(optInRequest.phoneNumber),
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTimeMs: Date.now() - startTime,
      });

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process opt-in request');
    }
  }

  private validateBulkRequestSize(phoneNumberCount: number): void {
    if (phoneNumberCount > this.maxBulkSize) {
      throw new BadRequestException(
        `Bulk request exceeds maximum size of ${this.maxBulkSize} phone numbers`,
      );
    }
  }

  private processPhoneNumbers(
    phoneNumbers: string[],
    operationId: string,
  ): {
    sanitizedNumbers: string[];
    phoneNumberMap: Map<string, string>;
    results: Record<string, OptOutStatusResponseDto>;
    totalErrors: number;
  } {
    const sanitizedNumbers: string[] = [];
    const phoneNumberMap = new Map<string, string>();
    const results: Record<string, OptOutStatusResponseDto> = {};
    let totalErrors = 0;

    for (const phoneNumber of phoneNumbers) {
      try {
        const sanitized = this.phoneValidator.sanitizePhoneNumber(phoneNumber);
        if (this.phoneValidator.validatePhoneNumber(sanitized)) {
          sanitizedNumbers.push(sanitized);
          phoneNumberMap.set(sanitized, phoneNumber);
        } else {
          results[phoneNumber] = this.createFailSafeResponse(phoneNumber);
          totalErrors++;
        }
      } catch (error) {
        this.logPhoneNumberValidationError(operationId, phoneNumber, error as Error);
        results[phoneNumber] = this.createFailSafeResponse(phoneNumber);
        totalErrors++;
      }
    }

    return { sanitizedNumbers, phoneNumberMap, results, totalErrors };
  }

  private createFailSafeResponse(phoneNumber: string): OptOutStatusResponseDto {
    return {
      phoneNumber: this.phoneValidator.maskPhoneNumber(phoneNumber),
      isOptedOut: true, // Fail safe - treat invalid numbers as opted out
      status: OptOutRecordStatus.ACTIVE,
      scope: OptOutScope.ALL_SMS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private logPhoneNumberValidationError(
    operationId: string,
    phoneNumber: string,
    error: Error,
  ): void {
    this.logger.warn(`Invalid phone number in bulk request`, {
      operationId,
      phoneNumber: this.phoneValidator.maskPhoneNumber(phoneNumber),
      error: error.message,
    });
  }

  private async fetchOptOutRecords(
    sanitizedNumbers: string[],
  ): Promise<LeanDocument<OptOutRecordDocument>[]> {
    const records = await this.optOutModel
      .find({
        phoneNumber: { $in: sanitizedNumbers },
        status: { $ne: OptOutRecordStatus.REVOKED },
      })
      .lean()
      .exec();
    return records;
  }

  private createRecordLookupMap(
    records: LeanDocument<OptOutRecordDocument>[],
  ): Map<string, LeanDocument<OptOutRecordDocument>> {
    const recordMap = new Map<string, LeanDocument<OptOutRecordDocument>>();
    records.forEach((record) => recordMap.set(record.phoneNumber, record));
    return recordMap;
  }

  private processOptOutResults(
    sanitizedNumbers: string[],
    phoneNumberMap: Map<string, string>,
    recordMap: Map<string, LeanDocument<OptOutRecordDocument>>,
    existingResults: Record<string, OptOutStatusResponseDto>,
    bulkRequest: BulkOptOutCheckDto,
  ): {
    processedResults: Record<string, OptOutStatusResponseDto>;
    counters: { totalOptedOut: number; totalActive: number };
  } {
    const results = { ...existingResults };
    let totalOptedOut = 0;
    let totalActive = 0;

    for (const sanitized of sanitizedNumbers) {
      const originalNumber = phoneNumberMap.get(sanitized)!;
      const record = recordMap.get(sanitized);

      if (!record) {
        results[originalNumber] = this.createActiveResponse(sanitized);
        totalActive++;
      } else {
        const response = this.createRecordResponse(record, sanitized, bulkRequest);
        results[originalNumber] = response;

        if (response.isOptedOut) {
          totalOptedOut++;
        } else {
          totalActive++;
        }
      }
    }

    return {
      processedResults: results,
      counters: { totalOptedOut, totalActive },
    };
  }

  private createActiveResponse(sanitizedPhoneNumber: string): OptOutStatusResponseDto {
    return {
      phoneNumber: this.phoneValidator.maskPhoneNumber(sanitizedPhoneNumber),
      isOptedOut: false,
      status: OptOutRecordStatus.ACTIVE,
      scope: OptOutScope.ALL_SMS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createRecordResponse(
    record: LeanDocument<OptOutRecordDocument>,
    sanitizedPhoneNumber: string,
    bulkRequest: BulkOptOutCheckDto,
  ): OptOutStatusResponseDto {
    const isExpired = record.expiresAt ? new Date() > record.expiresAt : false;
    const effectiveOptedOut = isExpired ? false : record.isOptedOut;

    const response: OptOutStatusResponseDto = {
      phoneNumber: this.phoneValidator.maskPhoneNumber(sanitizedPhoneNumber),
      isOptedOut: effectiveOptedOut,
      status: isExpired ? OptOutRecordStatus.EXPIRED : record.status,
      scope: record.scope,
      optedOutAt: record.optedOutAt,
      optedInAt: record.optedInAt,
      reason: record.reason,
      expiresAt: record.expiresAt,
      isExpired,
      userId: record.userId?.toString(),
      source: record.source,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    if (bulkRequest.includeAuditLog) {
      response.auditLog = record.auditLog;
    }

    if (bulkRequest.includeStats) {
      response.messageStats = record.messageStats;
    }

    return response;
  }

  private buildBulkResponse(
    results: Record<string, OptOutStatusResponseDto>,
    totalProcessed: number,
    totalOptedOut: number,
    totalActive: number,
    totalErrors: number,
    processingTimeMs: number,
  ): BulkOptOutStatusResponseDto {
    return {
      results,
      totalProcessed,
      totalOptedOut,
      totalActive,
      totalErrors,
      processedAt: new Date(),
      processingTimeMs,
    };
  }

  private logBulkOperationSuccess(
    operationId: string,
    response: BulkOptOutStatusResponseDto,
  ): void {
    this.logger.warn(`Bulk opt-out status check completed`, {
      operationId,
      totalProcessed: response.totalProcessed,
      totalOptedOut: response.totalOptedOut,
      totalActive: response.totalActive,
      totalErrors: response.totalErrors,
      processingTimeMs: response.processingTimeMs,
    });
  }

  private logBulkOperationError(
    operationId: string,
    totalRequested: number,
    error: Error,
    processingTimeMs: number,
  ): void {
    this.logger.error(`Failed to process bulk opt-out check`, {
      operationId,
      totalRequested,
      error: error.message,
      stack: error.stack,
      processingTimeMs,
    });
  }

  async bulkCheckOptOutStatus(
    bulkRequest: BulkOptOutCheckDto,
  ): Promise<BulkOptOutStatusResponseDto> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.validateBulkRequestSize(bulkRequest.phoneNumbers.length);

      const { sanitizedNumbers, phoneNumberMap, results, totalErrors } = this.processPhoneNumbers(
        bulkRequest.phoneNumbers,
        operationId,
      );

      const records = await this.fetchOptOutRecords(sanitizedNumbers);
      const recordMap = this.createRecordLookupMap(records);

      const { processedResults, counters } = this.processOptOutResults(
        sanitizedNumbers,
        phoneNumberMap,
        recordMap,
        results,
        bulkRequest,
      );

      const response = this.buildBulkResponse(
        processedResults,
        bulkRequest.phoneNumbers.length,
        counters.totalOptedOut,
        counters.totalActive,
        totalErrors,
        Date.now() - startTime,
      );

      this.logBulkOperationSuccess(operationId, response);
      return response;
    } catch (error) {
      this.logBulkOperationError(
        operationId,
        bulkRequest.phoneNumbers.length,
        error as Error,
        Date.now() - startTime,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process bulk opt-out status check');
    }
  }

  async getOptOutList(query: OptOutQueryDto): Promise<OptOutListResponseDto> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 50, 1000);
      const skip = (page - 1) * limit;
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

      // Build filter criteria
      const filter: FilterQuery<OptOutRecordDocument> = {};

      if (query.phoneNumber) {
        filter.phoneNumber = query.phoneNumber;
      }

      if (query.userId) {
        filter.userId = new Types.ObjectId(query.userId);
      }

      if (query.status) {
        filter.status = query.status;
      }

      if (query.reason) {
        filter.reason = query.reason;
      }

      if (query.scope) {
        filter.scope = query.scope;
      }

      if (query.isOptedOut !== undefined) {
        filter.isOptedOut = query.isOptedOut;
      }

      // Date range filtering
      if (query.startDate || query.endDate) {
        filter.createdAt = {};
        if (query.startDate) {
          filter.createdAt.$gte = query.startDate;
        }
        if (query.endDate) {
          filter.createdAt.$lte = query.endDate;
        }
      }

      // Text search
      if (query.search) {
        filter.$text = { $search: query.search };
      }

      // Execute queries in parallel
      const [records, total] = await Promise.all([
        this.optOutModel
          .find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.optOutModel.countDocuments(filter).exec(),
      ]);

      // Transform records to response format
      const data: OptOutStatusResponseDto[] = records.map((record) => {
        const isExpired = record.expiresAt ? new Date() > record.expiresAt : false;

        const response: OptOutStatusResponseDto = {
          phoneNumber: this.phoneValidator.maskPhoneNumber(record.phoneNumber),
          isOptedOut: isExpired ? false : record.isOptedOut,
          status: isExpired ? OptOutRecordStatus.EXPIRED : record.status,
          scope: record.scope,
          optedOutAt: record.optedOutAt,
          optedInAt: record.optedInAt,
          reason: record.reason,
          expiresAt: record.expiresAt,
          isExpired,
          userId: record.userId?.toString(),
          source: record.source,
          metadata: record.metadata,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };

        if (query.includeAuditLog) {
          response.auditLog = record.auditLog;
        }

        if (query.includeStats) {
          response.messageStats = record.messageStats as IMessageStats | undefined;
        }

        return response;
      });

      const totalPages = Math.ceil(total / limit);

      const response: OptOutListResponseDto = {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        query: {
          filters: filter,
          sort: { field: sortBy, order: query.sortOrder || 'desc' },
          search: query.search,
        },
        timestamp: new Date(),
      };

      this.logger.debug(`Opt-out list retrieved successfully`, {
        operationId,
        page,
        limit,
        total,
        recordsReturned: data.length,
        processingTimeMs: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to retrieve opt-out list`, {
        operationId,
        query,
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTimeMs: Date.now() - startTime,
      });

      throw new InternalServerErrorException('Failed to retrieve opt-out list');
    }
  }

  async cleanupExpiredRecords(): Promise<{ updated: number; errors: number }> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const result = await this.optOutModel
        .updateMany(
          {
            expiresAt: { $lte: new Date() },
            status: { $ne: OptOutRecordStatus.EXPIRED },
            isOptedOut: true,
          },
          {
            status: OptOutRecordStatus.EXPIRED,
            isOptedOut: false,
            $push: {
              auditLog: {
                action: 'expired',
                timestamp: new Date(),
                reason: 'Automatic cleanup - record expired',
                metadata: { operationId, cleanupType: 'scheduled' },
              },
            },
          },
        )
        .exec();

      this.logger.warn(`Expired opt-out records cleanup completed`, {
        operationId,
        recordsUpdated: result.modifiedCount,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        updated: result.modifiedCount,
        errors: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to cleanup expired opt-out records`, {
        operationId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        updated: 0,
        errors: 1,
      };
    }
  }

  async canSendMessage(
    phoneNumber: string,
    messageType: string = 'general',
  ): Promise<{
    canSend: boolean;
    reason?: string | undefined;
    record?: OptOutStatusResponseDto | undefined;
  }> {
    try {
      const status = await this.checkOptOutStatus(phoneNumber);

      if (!status.isOptedOut) {
        return { canSend: true, record: status };
      }

      // Check if the message type is allowed based on scope
      const record: OptOutRecordDocument | null = await this.optOutModel
        .findOne({
          phoneNumber: this.phoneValidator.sanitizePhoneNumber(phoneNumber),
        })
        .exec();

      if (!record) {
        return { canSend: true, record: status };
      }

      const canSend = record.canReceiveMessageType(messageType);

      return {
        canSend,
        reason: canSend
          ? undefined
          : `Phone number is opted out for ${messageType} messages (scope: ${record.scope})`,
        record: status,
      };
    } catch (error) {
      this.logger.error(`Failed to check message send permission`, {
        phoneNumber: this.phoneValidator.maskPhoneNumber(phoneNumber),
        messageType,
        error: (error as Error).message,
      });

      // Fail safe - don't send if can't verify
      return {
        canSend: false,
        reason: 'Unable to verify opt-out status',
      };
    }
  }

  private generateOperationId(): string {
    return `opt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async getOptOutStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalOptOuts: number;
    totalOptIns: number;
    activeOptOuts: number;
    expiredRecords: number;
    byReason: Record<string, number>;
    byScope: Record<string, number>;
    recentActivity: number;
  }> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const dateFilter: FilterQuery<OptOutRecordDocument> = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.$gte = startDate;
        }
        if (endDate) {
          dateFilter.createdAt.$lte = endDate;
        }
      }

      const [
        totalOptOuts,
        totalOptIns,
        activeOptOuts,
        expiredRecords,
        reasonStats,
        scopeStats,
        recentActivity,
      ] = await Promise.all([
        this.optOutModel.countDocuments({ ...dateFilter, isOptedOut: true }).exec(),
        this.optOutModel
          .countDocuments({ ...dateFilter, isOptedOut: false, optedInAt: { $exists: true } })
          .exec(),
        this.optOutModel
          .countDocuments({ isOptedOut: true, status: OptOutRecordStatus.ACTIVE })
          .exec(),
        this.optOutModel.countDocuments({ status: OptOutRecordStatus.EXPIRED }).exec(),
        this.optOutModel
          .aggregate([{ $match: dateFilter }, { $group: { _id: '$reason', count: { $sum: 1 } } }])
          .exec(),
        this.optOutModel
          .aggregate([{ $match: dateFilter }, { $group: { _id: '$scope', count: { $sum: 1 } } }])
          .exec(),
        this.optOutModel
          .countDocuments({
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          })
          .exec(),
      ]);

      const byReason: Record<string, number> = {};
      reasonStats.forEach((stat: { _id: string; count: number }) => {
        byReason[stat._id] = stat.count;
      });

      const byScope: Record<string, number> = {};
      scopeStats.forEach((stat: { _id: string; count: number }) => {
        byScope[stat._id] = stat.count;
      });

      this.logger.debug(`Opt-out statistics generated`, {
        operationId,
        totalOptOuts,
        activeOptOuts,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        totalOptOuts,
        totalOptIns,
        activeOptOuts,
        expiredRecords,
        byReason,
        byScope,
        recentActivity,
      };
    } catch (error) {
      this.logger.error(`Failed to generate opt-out statistics`, {
        operationId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTimeMs: Date.now() - startTime,
      });

      throw new InternalServerErrorException('Failed to generate opt-out statistics');
    }
  }
}
