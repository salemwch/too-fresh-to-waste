// 🇹🇳 Tunisia + 🌍 International Privacy Compliance Service
// Compliant with Tunisian Law No. 2004-63 and GDPR/CCPA

import * as crypto from 'crypto';

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import {
  USER_AUDIT_LOG_MAX,
  USER_CONSENT_RECORDS_MAX,
} from '../../common/constants/database-indexes.constant';
import { Notification } from '../../notifications/schemas/notification.schema';
import {
  TunisianPrivacyConsentDto,
  InternationalPrivacyConsentDto,
  DataExportRequestDto,
  DataDeletionRequestDto,
  ConsentWithdrawalDto,
} from '../DTO/privacy-consent.dto';
import {
  ConsentType,
  ConsentStatus,
  LegalBasis,
  IConsentRecord,
  IUserDataExport,
  IAnonymizationResult,
  IPrivacySettings,
  ISystemComplianceOverview,
} from '../interfaces/privacy-consent.interface';
import { User, UserDocument, UserStatus } from '../schemas/user.schema';

// Privacy Export Data Interfaces
interface IPrivacyOrderData {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  items: Array<{
    title: string;
    quantity: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  currency: string;
  scheduledPickupDate?: Date;
  actualPickupDate?: Date;
  customerNotes?: string;
  orderDate?: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

interface IPrivacyFavoriteData {
  type: string;
  itemName?: string;
  itemImage?: string;
  addedAt: Date;
  lastInteraction?: Date;
  interactionCount: number;
  notificationCount: number;
  preferences: {
    notifications: boolean;
    emailAlerts: boolean;
    pushNotifications: boolean;
    maxDistance: number;
  };
  tags: string[];
  notes?: string;
}

interface IConsentRecordsStatsResult {
  totalRecords: number;
}

interface IPrivacyReviewData {
  type: string;
  overallRating: number;
  detailedRatings: {
    foodQuality?: number;
    serviceQuality?: number;
    valueForMoney?: number;
    packaging?: number;
    pickupExperience?: number;
    sustainability?: number;
  };
  comment: string;
  title?: string;
  status: string;
  metrics: {
    helpfulCount: number;
    notHelpfulCount: number;
    viewCount: number;
  };
  isVerifiedPurchase: boolean;
  isRecommended: boolean;
  sentimentAnalysis: {
    sentiment?: string;
    confidence?: number;
  };
  tags: string[];
  createdAt?: Date;
  lastEditedAt?: Date;
}

interface IPrivacyNotificationData {
  type: string;
  channel: string;
  trigger: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  isRead: boolean;
  isBulk: boolean;
  campaign?: string;
  segment?: string;
  createdAt?: Date;
  expiresAt?: Date;
}

interface PrivacyOrderRecord {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  items?: Array<{ offerTitle: string; quantity: number; totalPrice: number }>;
  pricing?: { total?: number; currency?: string };
  pickupDetails?: { scheduledDate?: Date; actualPickupTime?: Date };
  customerNotes?: string;
  createdAt?: Date;
  confirmedAt?: Date;
  pickedUpAt?: Date;
  cancelledAt?: Date;
}

interface PrivacyFavoriteRecord {
  type: string;
  itemName?: string;
  itemImage?: string;
  addedAt: Date;
  lastInteraction?: Date;
  interactionCount?: number;
  notificationCount?: number;
  preferences?: {
    notifications?: boolean;
    emailAlerts?: boolean;
    pushNotifications?: boolean;
    maxDistance?: number;
  };
  tags?: string[];
  notes?: string;
}

interface PrivacyReviewRecord {
  type: string;
  overallRating: number;
  detailedRatings?: {
    foodQuality?: number;
    serviceQuality?: number;
    valueForMoney?: number;
    packaging?: number;
    pickupExperience?: number;
    sustainability?: number;
  };
  comment: string;
  title?: string;
  status: string;
  metrics?: {
    helpfulCount?: number;
    notHelpfulCount?: number;
    viewCount?: number;
  };
  isVerifiedPurchase?: boolean;
  isRecommended?: boolean;
  sentimentAnalysis?: {
    sentiment?: string;
    confidence?: number;
  };
  tags?: string[];
  createdAt?: Date;
  lastEditedAt?: Date;
}

// Interface for user privacy settings input - matches User schema structure
interface IUserPrivacySettingsInput {
  tunisianCompliance?: {
    dataProcessingConsent?: boolean;
    locationTrackingConsent?: boolean;
    communicationConsent?: boolean;
    consentGivenAt?: Date;
    consentVersion?: string;
    legalBasisTunisia?: LegalBasis;
  };
  internationalCompliance?: {
    marketingOptIn?: boolean;
    analyticsOptIn?: boolean;
    thirdPartySharing?: boolean;
    profilingOptIn?: boolean;
    cookiesConsent?: boolean;
    gdprConsentGiven?: boolean;
    ccpaOptOutRequested?: boolean;
  };
  consentRecords?: Array<{
    consentType: ConsentType;
    status: ConsentStatus;
    legalBasis: LegalBasis;
    givenAt: Date;
    withdrawnAt?: Date;
    expiresAt?: Date;
    ipAddress: string;
    userAgent: string;
    consentVersion: string;
    processingPurpose: string;
    dataCategories: string[];
    retentionPeriod: number;
    thirdParties?: string[];
  }>;
  dataSubjectRights?: {
    dataPortabilityRequested?: boolean;
    deletionRequested?: boolean;
    restrictionRequested?: boolean;
    objectionRequested?: boolean;
    lastExportDate?: Date;
    pendingRequests?: string[];
  };
  lastPrivacyPolicyUpdate?: Date;
  lastConsentRefresh?: Date;
  privacyOfficerNotified?: boolean;
  lastUpdated?: Date;
  consentVersion?: string;
}

@Injectable()
export class PrivacyComplianceService {
  private readonly logger = new Logger(PrivacyComplianceService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    private readonly configService: ConfigService,
  ) {
    const key = this.configService.get<string>('PRIVACY_ENCRYPTION_KEY');
    if (!key) {
      this.logger.warn(
        'PRIVACY_ENCRYPTION_KEY not set — privacy encryption features will be unavailable. ' +
          'This is REQUIRED in production for GDPR/Tunisian Law compliance.',
      );
    }
  }

  async recordTunisianConsent(
    userId: string,
    consentData: TunisianPrivacyConsentDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    this.logger.log(`🇹🇳 Recording Tunisian consent for user ${userId}`);

    const consentRecord: IConsentRecord = {
      consentType: ConsentType.PERSONAL_DATA_COLLECTION,
      status: ConsentStatus.GIVEN,
      legalBasis: consentData.legalBasis,
      givenAt: new Date(),
      ipAddress,
      userAgent,
      consentVersion: consentData.consentVersion,
      processingPurpose: 'Food waste marketplace operations - Tunisia Law No. 2004-63',
      dataCategories: this.getTunisianDataCategories(consentData),
      retentionPeriod: 2555, // 7 years as per Tunisian commercial law
      thirdParties: [],
    };

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        'privacySettings.tunisianCompliance': {
          dataProcessingConsent: consentData.dataProcessingConsent,
          locationTrackingConsent: consentData.locationTrackingConsent,
          communicationConsent: consentData.communicationConsent,
          consentGivenAt: new Date(),
          consentVersion: consentData.consentVersion,
          legalBasisTunisia: consentData.legalBasis,
        },
      },
      $push: {
        'privacySettings.consentRecords': {
          $each: [consentRecord],
          $slice: -USER_CONSENT_RECORDS_MAX,
        },
        auditLog: {
          $each: [
            {
              action: '🇹🇳 TUNISIA_CONSENT_RECORDED',
              timestamp: new Date(),
              ipAddress,
              userAgent,
              details: { consentData, legalBasis: consentData.legalBasis },
            },
          ],
          $slice: -USER_AUDIT_LOG_MAX,
        },
      },
    });

    this.logger.log(`✅ Tunisian consent recorded successfully for user ${userId}`);
  }

  /**
   * Validate Tunisian compliance status
   */
  async validateTunisianCompliance(userId: string): Promise<{
    compliant: boolean;
    missingConsents: string[];
    recommendations: string[];
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tunisianConsent = user.privacySettings?.tunisianCompliance;
    const missingConsents: string[] = [];
    const recommendations: string[] = [];

    // 🇹🇳 Tunisia Law Requirements
    if (tunisianConsent?.dataProcessingConsent !== true) {
      missingConsents.push('🇹🇳 Personal data processing consent required by Tunisia Law');
      recommendations.push('Obtain explicit consent for personal data collection and processing');
    }

    if (tunisianConsent?.communicationConsent !== true) {
      missingConsents.push('🇹🇳 Communication consent for email/SMS required');
      recommendations.push('Get consent for marketing communications');
    }

    if (
      user.locationPreferences?.shareLocation === true &&
      tunisianConsent?.locationTrackingConsent !== true
    ) {
      missingConsents.push('🇹🇳 Location tracking consent required for GPS data');
      recommendations.push('Obtain consent for location data collection');
    }

    const compliant = missingConsents.length === 0;

    this.logger.log(
      `🇹🇳 Tunisia compliance check for user ${userId}: ${compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`,
    );

    return { compliant, missingConsents, recommendations };
  }

  // 🌍 INTERNATIONAL COMPLIANCE - GDPR/CCPA

  /**
   * Record international consent (GDPR/CCPA)
   */
  async recordInternationalConsent(
    userId: string,
    consentData: InternationalPrivacyConsentDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    this.logger.log(`🌍 Recording international consent for user ${userId}`);

    // First record Tunisian base compliance
    await this.recordTunisianConsent(userId, consentData, ipAddress, userAgent);

    // Then record international extensions
    const gdprConsentRecord: IConsentRecord = {
      consentType: ConsentType.ANALYTICS_TRACKING,
      status: ConsentStatus.GIVEN,
      legalBasis: LegalBasis.GDPR_CONSENT,
      givenAt: new Date(),
      ipAddress,
      userAgent,
      consentVersion: consentData.consentVersion,
      processingPurpose: 'Analytics and marketing - GDPR Article 6(1)(a)',
      dataCategories: this.getInternationalDataCategories(consentData),
      retentionPeriod: 1095, // 3 years for marketing data
      thirdParties: consentData.thirdPartySharing ? ['Google Analytics', 'Marketing Partners'] : [],
    };

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        'privacySettings.internationalCompliance': {
          marketingOptIn: consentData.marketingOptIn,
          analyticsOptIn: consentData.analyticsOptIn,
          thirdPartySharing: consentData.thirdPartySharing,
          profilingOptIn: consentData.profilingOptIn,
          cookiesConsent: consentData.cookiesConsent,
          gdprConsentGiven: true,
          ccpaOptOutRequested: false,
        },
      },
      $push: {
        'privacySettings.consentRecords': {
          $each: [gdprConsentRecord],
          $slice: -USER_CONSENT_RECORDS_MAX,
        },
        auditLog: {
          $each: [
            {
              action: '🌍 INTERNATIONAL_CONSENT_RECORDED',
              timestamp: new Date(),
              ipAddress,
              userAgent,
              details: { consentData, regions: ['GDPR', 'CCPA'] },
            },
          ],
          $slice: -USER_AUDIT_LOG_MAX,
        },
      },
    });

    this.logger.log(`✅ International consent recorded successfully for user ${userId}`);
  }

  /**
   * Withdraw specific consent
   */
  async withdrawConsent(userId: string, withdrawalData: ConsentWithdrawalDto): Promise<void> {
    this.logger.log(
      `🔄 Processing consent withdrawal for user ${userId}, type: ${withdrawalData.consentType}`,
    );

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the specific consent record
    const consentRecords = user.privacySettings?.consentRecords ?? [];
    const consentIndex = consentRecords.findIndex(
      (record) =>
        record.consentType === withdrawalData.consentType && record.status === ConsentStatus.GIVEN,
    );

    if (consentIndex === -1) {
      throw new BadRequestException('No active consent found for the specified type');
    }

    // Update consent record
    const existingConsent = consentRecords[consentIndex];
    if (!existingConsent) {
      throw new BadRequestException('No active consent found for the specified type');
    }

    const withdrawalRecord: IConsentRecord = {
      ...existingConsent,
      status: ConsentStatus.WITHDRAWN,
      withdrawnAt: new Date(),
    };

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        [`privacySettings.consentRecords.${consentIndex}`]: withdrawalRecord,
      },
      $push: {
        auditLog: {
          $each: [
            {
              action: `CONSENT_WITHDRAWN_${withdrawalData.consentType}`,
              timestamp: new Date(),
              ipAddress: withdrawalData.ipAddress,
              userAgent: withdrawalData.userAgent,
              details: {
                consentType: withdrawalData.consentType,
                reason: withdrawalData.reason,
                stopProcessing: withdrawalData.stopProcessingImmediately,
              },
            },
          ],
          $slice: -USER_AUDIT_LOG_MAX,
        },
      },
    });

    // If immediate stop requested, trigger data processing restrictions
    if (withdrawalData.stopProcessingImmediately === true) {
      await this.restrictDataProcessing(userId, withdrawalData.consentType);
    }

    this.logger.log(`✅ Consent withdrawn successfully for user ${userId}`);
  }

  // DATA EXPORT & PORTABILITY

  /**
   * Export user data in compliance with GDPR Article 20 & Tunisia Law
   */
  async exportUserData(
    userId: string,
    exportRequest: DataExportRequestDto,
    requestIp: string,
    userAgent: string,
  ): Promise<IUserDataExport> {
    this.logger.log(`📤 Starting data export for user ${userId}, format: ${exportRequest.format}`);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Record export request for audit
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        'privacySettings.dataSubjectRights.lastExportDate': new Date(),
      },
      $push: {
        auditLog: {
          $each: [
            {
              action: 'DATA_EXPORT_REQUESTED',
              timestamp: new Date(),
              ipAddress: requestIp,
              userAgent,
              details: { format: exportRequest.format, legalBasis: exportRequest.legalBasis },
            },
          ],
          $slice: -USER_AUDIT_LOG_MAX,
        },
      },
    });

    // Gather all user data
    const exportData: IUserDataExport = {
      personalData: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        profileImage: user.profileImage,
        createdAt: user.createdAt ?? new Date(),
        lastLoginAt: user.lastLoginAt,
      },
      privacySettings: this.buildCompletePrivacySettings(user.privacySettings ?? {}),
      activityData: {
        loginHistory: user.loginHistory ?? [],
        locationHistory:
          exportRequest.includeActivityData === true
            ? user.locationPreferences?.locationHistory?.map((entry: Record<string, unknown>) => ({
                timestamp: entry['timestamp'] as Date,
                latitude: (entry['coordinates'] as Record<string, unknown>)?.['latitude'] as number,
                longitude: (entry['coordinates'] as Record<string, unknown>)?.[
                  'longitude'
                ] as number,
                accuracy: entry['accuracy'] as number,
              }))
            : undefined,
      },
      applicationData: {
        orders:
          exportRequest.includeApplicationData === true ? await this.getUserOrders(userId) : [],
        favorites:
          exportRequest.includeApplicationData === true ? await this.getUserFavorites(userId) : [],
        reviews:
          exportRequest.includeApplicationData === true ? await this.getUserReviews(userId) : [],
        notifications:
          exportRequest.includeApplicationData === true
            ? await this.getUserNotifications(userId)
            : [],
      },
      exportMetadata: {
        requestedAt: new Date(),
        exportedAt: new Date(),
        format: exportRequest.format,
        version: '1.0',
        legal_notices: {
          tunisia_law:
            '🇹🇳 Data exported in compliance with Tunisia Law No. 2004-63 on Personal Data Protection',
          gdpr_notice: '🌍 Data exported under GDPR Article 20 - Right to data portability',
          ccpa_notice: '🌍 Data exported under CCPA Section 1798.110 - Right to know',
        },
      },
    };

    this.logger.log(`✅ Data export completed for user ${userId}`);
    return exportData;
  }

  // DATA DELETION & ANONYMIZATION

  /**
   * Process data deletion request (Right to be Forgotten)
   */
  async processDataDeletion(
    userId: string,
    deletionRequest: DataDeletionRequestDto,
    requestIp: string,
    userAgent: string,
  ): Promise<IAnonymizationResult> {
    this.logger.log(
      `🗑️ Processing data deletion for user ${userId}, type: ${deletionRequest.deletionType}`,
    );

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let result: IAnonymizationResult;

    switch (deletionRequest.deletionType) {
      case 'soft_delete':
        result = await this.softDeleteUser(userId, deletionRequest, requestIp, userAgent);
        break;
      case 'anonymization':
        result = await this.anonymizeUser(userId, deletionRequest, requestIp, userAgent);
        break;
      case 'complete_deletion':
        result = await this.completeDeleteUser(userId, deletionRequest, requestIp, userAgent);
        break;
      default:
        throw new BadRequestException('Invalid deletion type');
    }

    this.logger.log(`✅ Data deletion completed for user ${userId}`);
    return result;
  }

  // PRIVATE HELPER METHODS

  private getTunisianDataCategories(consent: TunisianPrivacyConsentDto): string[] {
    const categories = ['basic_profile'];

    if (consent.dataProcessingConsent) {
      categories.push('personal_identifiers', 'contact_information');
    }
    if (consent.locationTrackingConsent) {
      categories.push('location_data', 'geolocation_history');
    }
    if (consent.communicationConsent) {
      categories.push('communication_preferences', 'marketing_data');
    }

    return categories;
  }

  private getInternationalDataCategories(consent: InternationalPrivacyConsentDto): string[] {
    const categories = this.getTunisianDataCategories(consent);

    if (consent.analyticsOptIn) {
      categories.push('usage_analytics', 'behavioral_data');
    }
    if (consent.profilingOptIn) {
      categories.push('user_preferences', 'recommendation_data');
    }
    if (consent.cookiesConsent) {
      categories.push('cookie_data', 'session_information');
    }

    return [...new Set(categories)]; // Remove duplicates
  }

  private async restrictDataProcessing(userId: string, consentType: ConsentType): Promise<void> {
    // Implementation to stop specific data processing based on consent type
    this.logger.log(
      `🚫 Restricting data processing for user ${userId}, consent type: ${consentType}`,
    );

    await this.userModel.findByIdAndUpdate(userId, {
      $push: {
        'privacySettings.dataSubjectRights.pendingRequests': `RESTRICT_${consentType}`,
      },
    });
  }

  private async softDeleteUser(
    userId: string,
    request: DataDeletionRequestDto,
    requestIp: string,
    userAgent: string,
  ): Promise<IAnonymizationResult> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
        deletionReason: request.reason,
        // Keep minimal data for legal obligations if requested
        ...(request.retainLegalData === true && {
          'privacySettings.dataSubjectRights.deletionRequested': true,
        }),
      },
      $push: {
        auditLog: {
          $each: [
            {
              action: '🇹🇳🌍 USER_SOFT_DELETED',
              timestamp: new Date(),
              ipAddress: requestIp,
              userAgent,
              details: request,
            },
          ],
          $slice: -USER_AUDIT_LOG_MAX,
        },
      },
    });

    return {
      userId,
      anonymizedAt: new Date(),
      dataRetained: request.retainLegalData === true ? ['legal_obligations', 'audit_trail'] : [],
      dataAnonymized: [],
      dataDeleted: ['active_profile', 'personal_preferences'],
      legalBasis: '🇹🇳 Tunisia Law No. 2004-63 + 🌍 GDPR Article 17',
    };
  }

  private async anonymizeUser(
    userId: string,
    _request: DataDeletionRequestDto,
    _requestIp: string,
    _userAgent: string,
  ): Promise<IAnonymizationResult> {
    const anonymizedData = {
      email: `anonymized_${crypto.randomUUID()}@deleted.local`,
      firstName: 'Anonymized',
      lastName: 'User',
      phoneNumber: undefined,
      profileImage: undefined,
      isAnonymized: true,
      anonymizedAt: new Date(),
      status: UserStatus.ANONYMIZED,
    };

    await this.userModel.findByIdAndUpdate(userId, {
      $set: anonymizedData,
      $push: {
        auditLog: {
          $each: [
            {
              action: '🇹🇳🌍 USER_ANONYMIZED',
              timestamp: new Date(),
              ipAddress: _requestIp,
              userAgent: _userAgent,
              details: { ..._request, anonymizedFields: Object.keys(anonymizedData) },
            },
          ],
          $slice: -USER_AUDIT_LOG_MAX,
        },
      },
    });

    return {
      userId,
      anonymizedAt: new Date(),
      dataRetained: ['transaction_history', 'legal_compliance'],
      dataAnonymized: ['personal_identifiers', 'contact_information', 'profile_data'],
      dataDeleted: ['marketing_data', 'preferences'],
      legalBasis: '🇹🇳 Tunisia Law + 🌍 GDPR Article 17 - Anonymization',
    };
  }

  private async completeDeleteUser(
    userId: string,
    _request: DataDeletionRequestDto,
    _requestIp: string,
    _userAgent: string,
  ): Promise<IAnonymizationResult> {
    // Complete deletion - use with extreme caution
    await this.userModel.findByIdAndDelete(userId);

    return {
      userId,
      anonymizedAt: new Date(),
      dataRetained: [],
      dataAnonymized: [],
      dataDeleted: ['all_user_data'],
      legalBasis: '🌍 GDPR Article 17 - Complete deletion (irreversible)',
    };
  }

  // Data gathering methods for privacy export

  /**
   * Fetch user's order history for privacy export
   * @param userId User ID to fetch orders for
   * @returns Array of sanitized order data
   */
  private async getUserOrders(userId: string): Promise<IPrivacyOrderData[]> {
    try {
      const orders = (await this.connection
        .collection('orders')
        .find({
          customerId: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        })
        .project({
          orderNumber: 1,
          status: 1,
          paymentStatus: 1,
          'items.offerTitle': 1,
          'items.quantity': 1,
          'items.totalPrice': 1,
          'pricing.total': 1,
          'pricing.currency': 1,
          'pickupDetails.scheduledDate': 1,
          'pickupDetails.actualPickupTime': 1,
          customerNotes: 1,
          createdAt: 1,
          confirmedAt: 1,
          pickedUpAt: 1,
          cancelledAt: 1,
        })
        .sort({ createdAt: -1 })
        .toArray()) as PrivacyOrderRecord[];

      return orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items:
          order.items?.map((item) => ({
            title: item.offerTitle,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
          })) ?? [],
        totalAmount: order.pricing?.total ?? 0,
        currency: order.pricing?.currency ?? 'EUR',
        ...(order.pickupDetails?.scheduledDate !== undefined
          ? { scheduledPickupDate: order.pickupDetails.scheduledDate }
          : {}),
        ...(order.pickupDetails?.actualPickupTime !== undefined
          ? { actualPickupDate: order.pickupDetails.actualPickupTime }
          : {}),
        ...(order.customerNotes !== undefined ? { customerNotes: order.customerNotes } : {}),
        ...(order.createdAt !== undefined ? { orderDate: order.createdAt } : {}),
        ...(order.confirmedAt !== undefined ? { confirmedAt: order.confirmedAt } : {}),
        ...(order.pickedUpAt !== undefined ? { completedAt: order.pickedUpAt } : {}),
        ...(order.cancelledAt !== undefined ? { cancelledAt: order.cancelledAt } : {}),
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch orders for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch user's favorites for privacy export
   * @param userId User ID to fetch favorites for
   * @returns Array of sanitized favorite data
   */
  private async getUserFavorites(userId: string): Promise<IPrivacyFavoriteData[]> {
    try {
      const favorites = (await this.connection
        .collection('favorites')
        .find({
          userId: new Types.ObjectId(userId),
          isActive: true,
        })
        .project({
          type: 1,
          itemName: 1,
          itemImage: 1,
          addedAt: 1,
          lastInteraction: 1,
          interactionCount: 1,
          notificationCount: 1,
          'preferences.notifications': 1,
          'preferences.emailAlerts': 1,
          'preferences.pushNotifications': 1,
          'preferences.maxDistance': 1,
          tags: 1,
          notes: 1,
        })
        .sort({ addedAt: -1 })
        .toArray()) as PrivacyFavoriteRecord[];

      return favorites.map((favorite) => ({
        type: favorite.type,
        ...(favorite.itemName !== undefined ? { itemName: favorite.itemName } : {}),
        ...(favorite.itemImage !== undefined ? { itemImage: favorite.itemImage } : {}),
        addedAt: favorite.addedAt,
        ...(favorite.lastInteraction !== undefined
          ? { lastInteraction: favorite.lastInteraction }
          : {}),
        interactionCount: favorite.interactionCount ?? 0,
        notificationCount: favorite.notificationCount ?? 0,
        preferences: {
          notifications: favorite.preferences?.notifications ?? true,
          emailAlerts: favorite.preferences?.emailAlerts ?? true,
          pushNotifications: favorite.preferences?.pushNotifications ?? true,
          maxDistance: favorite.preferences?.maxDistance ?? 5,
        },
        tags: favorite.tags ?? [],
        ...(favorite.notes !== undefined ? { notes: favorite.notes } : {}),
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch favorites for user ${userId}:`, error);
      return [];
    }
  }

  private async getUserReviews(userId: string): Promise<IPrivacyReviewData[]> {
    try {
      const reviews = (await this.connection
        .collection('reviews')
        .find({
          reviewerId: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        })
        .project({
          type: 1,
          overallRating: 1,
          'detailedRatings.foodQuality': 1,
          'detailedRatings.serviceQuality': 1,
          'detailedRatings.valueForMoney': 1,
          'detailedRatings.packaging': 1,
          'detailedRatings.pickupExperience': 1,
          'detailedRatings.sustainability': 1,
          comment: 1,
          title: 1,
          status: 1,
          'metrics.helpfulCount': 1,
          'metrics.notHelpfulCount': 1,
          'metrics.viewCount': 1,
          isVerifiedPurchase: 1,
          isRecommended: 1,
          'sentimentAnalysis.sentiment': 1,
          'sentimentAnalysis.confidence': 1,
          tags: 1,
          createdAt: 1,
          lastEditedAt: 1,
        })
        .sort({ createdAt: -1 })
        .toArray()) as PrivacyReviewRecord[];

      return reviews.map((review) => ({
        type: review.type,
        overallRating: review.overallRating,
        detailedRatings: {
          ...(review.detailedRatings?.foodQuality !== undefined
            ? { foodQuality: review.detailedRatings.foodQuality }
            : {}),
          ...(review.detailedRatings?.serviceQuality !== undefined
            ? { serviceQuality: review.detailedRatings.serviceQuality }
            : {}),
          ...(review.detailedRatings?.valueForMoney !== undefined
            ? { valueForMoney: review.detailedRatings.valueForMoney }
            : {}),
          ...(review.detailedRatings?.packaging !== undefined
            ? { packaging: review.detailedRatings.packaging }
            : {}),
          ...(review.detailedRatings?.pickupExperience !== undefined
            ? { pickupExperience: review.detailedRatings.pickupExperience }
            : {}),
          ...(review.detailedRatings?.sustainability !== undefined
            ? { sustainability: review.detailedRatings.sustainability }
            : {}),
        },
        comment: review.comment,
        ...(review.title !== undefined ? { title: review.title } : {}),
        status: review.status,
        metrics: {
          helpfulCount: review.metrics?.helpfulCount ?? 0,
          notHelpfulCount: review.metrics?.notHelpfulCount ?? 0,
          viewCount: review.metrics?.viewCount ?? 0,
        },
        isVerifiedPurchase: review.isVerifiedPurchase ?? false,
        isRecommended: review.isRecommended ?? false,
        sentimentAnalysis: {
          ...(review.sentimentAnalysis?.sentiment !== undefined
            ? { sentiment: review.sentimentAnalysis.sentiment }
            : {}),
          ...(review.sentimentAnalysis?.confidence !== undefined
            ? { confidence: review.sentimentAnalysis.confidence }
            : {}),
        },
        tags: review.tags ?? [],
        ...(review.createdAt !== undefined ? { createdAt: review.createdAt } : {}),
        ...(review.lastEditedAt !== undefined ? { lastEditedAt: review.lastEditedAt } : {}),
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch reviews for user ${userId}:`, error);
      return [];
    }
  }
  private buildCompletePrivacySettings(userSettings: IUserPrivacySettingsInput): IPrivacySettings {
    return {
      // 🇹🇳 Tunisia Base Requirements
      dataProcessingConsent: userSettings.tunisianCompliance?.dataProcessingConsent ?? false,
      locationTrackingConsent: userSettings.tunisianCompliance?.locationTrackingConsent ?? false,
      communicationConsent: userSettings.tunisianCompliance?.communicationConsent ?? false,

      // 🌍 International Extended Settings
      marketingOptIn: userSettings.internationalCompliance?.marketingOptIn ?? false,
      analyticsOptIn: userSettings.internationalCompliance?.analyticsOptIn ?? false,
      thirdPartySharing: userSettings.internationalCompliance?.thirdPartySharing ?? false,
      profilingOptIn: userSettings.internationalCompliance?.profilingOptIn ?? false,
      cookiesConsent: userSettings.internationalCompliance?.cookiesConsent ?? false,

      // Consent Records
      consentRecords: userSettings.consentRecords ?? [],

      // Data Subject Rights
      dataPortabilityRequested: userSettings.dataSubjectRights?.dataPortabilityRequested ?? false,
      deletionRequested: userSettings.dataSubjectRights?.deletionRequested ?? false,
      restrictionRequested: userSettings.dataSubjectRights?.restrictionRequested ?? false,

      // Technical Settings
      lastUpdated: userSettings.lastUpdated ?? new Date(),
      consentVersion: userSettings.consentVersion ?? '1.0',
    };
  }

  private async getUserNotifications(userId: string): Promise<IPrivacyNotificationData[]> {
    try {
      const notifications = await this.notificationModel
        .find({
          userId,
        })
        .select({
          type: 1,
          channel: 1,
          trigger: 1,
          title: 1,
          body: 1,
          status: 1,
          priority: 1,
          scheduledAt: 1,
          sentAt: 1,
          deliveredAt: 1,
          readAt: 1,
          isRead: 1,
          isBulk: 1,
          'metadata.campaign': 1,
          'metadata.segment': 1,
          createdAt: 1,
          expiresAt: 1,
        })
        .sort({ createdAt: -1 })
        .limit(1000) // Limit to last 1000 notifications
        .lean()
        .exec();

      return notifications.map((notification) => ({
        type: notification.type,
        channel: notification.channel,
        trigger: notification.trigger,
        title: notification.title,
        body: notification.body,
        status: notification.status,
        priority: notification.priority,
        ...(notification.scheduledAt !== undefined
          ? { scheduledAt: notification.scheduledAt }
          : {}),
        ...(notification.sentAt !== undefined ? { sentAt: notification.sentAt } : {}),
        ...(notification.deliveredAt !== undefined
          ? { deliveredAt: notification.deliveredAt }
          : {}),
        ...(notification.readAt !== undefined ? { readAt: notification.readAt } : {}),
        isRead: notification.isRead || false,
        isBulk: notification.isBulk || false,
        ...(notification.metadata?.campaign !== undefined
          ? { campaign: notification.metadata.campaign }
          : {}),
        ...(notification.metadata?.segment !== undefined
          ? { segment: notification.metadata.segment }
          : {}),
        ...(notification.createdAt !== undefined ? { createdAt: notification.createdAt } : {}),
        ...(notification.expiresAt !== undefined ? { expiresAt: notification.expiresAt } : {}),
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch notifications for user ${userId}:`, error);
      return [];
    }
  }

  // ADMIN COMPLIANCE OVERVIEW

  /**
   * Get system-wide compliance overview for admin dashboard
   * @returns Comprehensive compliance statistics
   */
  async getSystemComplianceOverview(): Promise<ISystemComplianceOverview> {
    this.logger.log('📊 Generating system compliance overview');

    try {
      // Aggregate all users' privacy data in parallel for better performance
      const [
        totalUsersCount,
        tunisiaComplianceData,
        internationalComplianceData,
        dataSubjectRequestsData,
        consentRecordsData,
      ] = await Promise.all([
        this.getTotalActiveUsersCount(),
        this.getTunisiaComplianceStats(),
        this.getInternationalComplianceStats(),
        this.getDataSubjectRequestsStats(),
        this.getConsentRecordsStats(),
      ]);

      // Calculate compliance rates
      const tunisiaComplianceRate =
        totalUsersCount > 0
          ? Math.round((tunisiaComplianceData.compliantUsers / totalUsersCount) * 100 * 100) / 100
          : 0;

      const internationalComplianceRate =
        totalUsersCount > 0
          ? Math.round((internationalComplianceData.gdprCompliant / totalUsersCount) * 100 * 100) /
            100
          : 0;

      // Generate audit summary
      const auditSummary = this.generateAuditSummary(
        tunisiaComplianceData,
        internationalComplianceData,
        dataSubjectRequestsData,
        consentRecordsData.totalRecords,
      );

      const overview: ISystemComplianceOverview = {
        tunisiaCompliance: {
          totalUsers: totalUsersCount,
          compliantUsers: tunisiaComplianceData.compliantUsers,
          pendingConsents: tunisiaComplianceData.pendingConsents,
          complianceRate: tunisiaComplianceRate,
          missingDataProcessingConsent: tunisiaComplianceData.missingDataProcessingConsent,
          missingLocationConsent: tunisiaComplianceData.missingLocationConsent,
          missingCommunicationConsent: tunisiaComplianceData.missingCommunicationConsent,
        },
        internationalCompliance: {
          gdprCompliant: internationalComplianceData.gdprCompliant,
          ccpaCompliant: internationalComplianceData.ccpaCompliant,
          pendingRequests: internationalComplianceData.pendingRequests,
          marketingOptIns: internationalComplianceData.marketingOptIns,
          analyticsOptIns: internationalComplianceData.analyticsOptIns,
          thirdPartyConsentGiven: internationalComplianceData.thirdPartyConsentGiven,
          internationalComplianceRate,
        },
        dataSubjectRequests: {
          exportRequests: dataSubjectRequestsData.exportRequests,
          deletionRequests: dataSubjectRequestsData.deletionRequests,
          consentWithdrawals: dataSubjectRequestsData.consentWithdrawals,
          restrictionRequests: dataSubjectRequestsData.restrictionRequests,
          objectionRequests: dataSubjectRequestsData.objectionRequests,
          pendingRequests: dataSubjectRequestsData.pendingRequests,
          lastExportDate: dataSubjectRequestsData.lastExportDate,
        },
        auditSummary,
      };

      this.logger.log(
        `✅ Compliance overview generated successfully. Overall compliance: ${auditSummary.complianceScore}`,
      );
      return overview;
    } catch (error) {
      this.logger.error('Failed to generate compliance overview:', error);
      throw error;
    }
  }

  private async getTotalActiveUsersCount(): Promise<number> {
    const count = await this.userModel.countDocuments({
      status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
    });
    return count;
  }

  private async getTunisiaComplianceStats(): Promise<{
    compliantUsers: number;
    pendingConsents: number;
    missingDataProcessingConsent: number;
    missingLocationConsent: number;
    missingCommunicationConsent: number;
  }> {
    const [
      compliantUsers,
      missingDataProcessingConsent,
      missingLocationConsent,
      missingCommunicationConsent,
    ] = await Promise.all([
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.tunisianCompliance.dataProcessingConsent': true,
        'privacySettings.tunisianCompliance.communicationConsent': true,
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.tunisianCompliance.dataProcessingConsent': { $ne: true },
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'locationPreferences.shareLocation': true,
        'privacySettings.tunisianCompliance.locationTrackingConsent': { $ne: true },
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.tunisianCompliance.communicationConsent': { $ne: true },
      }),
    ]);

    const pendingConsents =
      missingDataProcessingConsent + missingLocationConsent + missingCommunicationConsent;

    return {
      compliantUsers,
      pendingConsents,
      missingDataProcessingConsent,
      missingLocationConsent,
      missingCommunicationConsent,
    };
  }

  private async getInternationalComplianceStats(): Promise<{
    gdprCompliant: number;
    ccpaCompliant: number;
    pendingRequests: number;
    marketingOptIns: number;
    analyticsOptIns: number;
    thirdPartyConsentGiven: number;
  }> {
    const [
      gdprCompliant,
      ccpaCompliant,
      marketingOptIns,
      analyticsOptIns,
      thirdPartyConsentGiven,
      pendingRequests,
    ] = await Promise.all([
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.internationalCompliance.gdprConsentGiven': true,
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.internationalCompliance.ccpaOptOutRequested': false,
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.internationalCompliance.marketingOptIn': true,
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.internationalCompliance.analyticsOptIn': true,
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.internationalCompliance.thirdPartySharing': true,
      }),
      this.userModel.countDocuments({
        status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] },
        'privacySettings.dataSubjectRights.pendingRequests.0': { $exists: true },
      }),
    ]);

    return {
      gdprCompliant,
      ccpaCompliant,
      pendingRequests,
      marketingOptIns,
      analyticsOptIns,
      thirdPartyConsentGiven,
    };
  }

  private async getDataSubjectRequestsStats(): Promise<{
    exportRequests: number;
    deletionRequests: number;
    consentWithdrawals: number;
    restrictionRequests: number;
    objectionRequests: number;
    pendingRequests: number;
    lastExportDate?: Date | undefined;
  }> {
    const [
      exportRequests,
      deletionRequests,
      restrictionRequests,
      objectionRequests,
      pendingRequests,
      lastExportResult,
    ] = await Promise.all([
      this.userModel.countDocuments({
        'privacySettings.dataSubjectRights.lastExportDate': { $exists: true },
      }),
      this.userModel.countDocuments({
        'privacySettings.dataSubjectRights.deletionRequested': true,
      }),
      this.userModel.countDocuments({
        'privacySettings.dataSubjectRights.restrictionRequested': true,
      }),
      this.userModel.countDocuments({
        'privacySettings.dataSubjectRights.objectionRequested': true,
      }),
      this.userModel.countDocuments({
        'privacySettings.dataSubjectRights.pendingRequests.0': { $exists: true },
      }),
      this.userModel
        .findOne(
          { 'privacySettings.dataSubjectRights.lastExportDate': { $exists: true } },
          { 'privacySettings.dataSubjectRights.lastExportDate': 1 },
        )
        .sort({ 'privacySettings.dataSubjectRights.lastExportDate': -1 }),
    ]);

    // Count consent withdrawals from audit logs
    const consentWithdrawals = await this.userModel.countDocuments({
      'auditLog.action': { $regex: /CONSENT_WITHDRAWN_/ },
    });

    return {
      exportRequests,
      deletionRequests,
      consentWithdrawals,
      restrictionRequests,
      objectionRequests,
      pendingRequests,
      lastExportDate: lastExportResult?.privacySettings?.dataSubjectRights?.lastExportDate,
    };
  }

  private async getConsentRecordsStats(): Promise<{ totalRecords: number }> {
    const result = await this.userModel.aggregate<IConsentRecordsStatsResult>([
      { $match: { status: { $nin: [UserStatus.DELETED, UserStatus.ANONYMIZED] } } },
      {
        $project: {
          consentRecordsCount: { $size: { $ifNull: ['$privacySettings.consentRecords', []] } },
        },
      },
      { $group: { _id: null, totalRecords: { $sum: '$consentRecordsCount' } } },
    ]);

    return { totalRecords: result[0]?.totalRecords ?? 0 };
  }

  private generateAuditSummary(
    tunisiaData: {
      compliantUsers: number;
      pendingConsents: number;
      missingDataProcessingConsent: number;
    },
    internationalData: { gdprCompliant: number; pendingRequests: number },
    dataSubjectData: { pendingRequests: number },
    totalConsentRecords: number,
  ): {
    lastAudit: Date;
    complianceScore: string;
    recommendedActions: string[];
    criticalIssues: number;
    warningIssues: number;
    totalConsentRecords: number;
  } {
    const recommendedActions: string[] = [];
    let criticalIssues = 0;
    let warningIssues = 0;

    // Critical issues analysis
    if (tunisiaData.missingDataProcessingConsent > 0) {
      criticalIssues++;
      recommendedActions.push('🚨 Address missing Tunisia data processing consents immediately');
    }

    if (dataSubjectData.pendingRequests > 5) {
      criticalIssues++;
      recommendedActions.push('🚨 Process pending data subject requests within legal timeframes');
    }

    // Warning issues analysis
    if (tunisiaData.pendingConsents > 10) {
      warningIssues++;
      recommendedActions.push('⚠️ Follow up on pending Tunisia consent requests');
    }

    if (internationalData.pendingRequests > 0) {
      warningIssues++;
      recommendedActions.push('⚠️ Review international compliance pending requests');
    }

    // Calculate overall compliance score
    const baseScore = 95;
    const criticalPenalty = criticalIssues * 15;
    const warningPenalty = warningIssues * 5;
    const finalScore = Math.max(0, baseScore - criticalPenalty - warningPenalty);

    // Add positive recommendations if score is good
    if (finalScore >= 90) {
      recommendedActions.push('✅ Maintain current privacy compliance standards');
    }

    if (finalScore >= 95) {
      recommendedActions.push('🏆 Consider privacy certification (ISO 27001, SOC 2)');
    }

    return {
      lastAudit: new Date(),
      complianceScore: `${finalScore}%`,
      recommendedActions,
      criticalIssues,
      warningIssues,
      totalConsentRecords,
    };
  }
}
