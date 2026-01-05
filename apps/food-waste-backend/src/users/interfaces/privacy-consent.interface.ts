// 🇹🇳 Tunisia + 🌍 International Privacy Consent Interfaces
// Compliant with Tunisian Law No. 2004-63 and GDPR/CCPA

export enum ConsentType {
  PERSONAL_DATA_COLLECTION = 'personal_data_collection',
  EMAIL_MARKETING = 'email_marketing',
  PHONE_CONTACT = 'phone_contact',
  GPS_LOCATION = 'gps_location',
  ANALYTICS_TRACKING = 'analytics_tracking',
  THIRD_PARTY_SHARING = 'third_party_sharing',
  PROFILING = 'profiling'
}

export enum ConsentStatus {
  GIVEN = 'given',
  WITHDRAWN = 'withdrawn',
  PENDING = 'pending',
  EXPIRED = 'expired'
}

export enum LegalBasis {
  // 🇹🇳 Tunisia Law No. 2004-63
  TN_EXPLICIT_CONSENT = 'tn_explicit_consent',
  TN_LEGITIMATE_INTEREST = 'tn_legitimate_interest',
  TN_CONTRACT_NECESSITY = 'tn_contract_necessity',

  // 🌍 International GDPR/CCPA
  GDPR_CONSENT = 'gdpr_consent',
  GDPR_CONTRACT = 'gdpr_contract',
  GDPR_LEGAL_OBLIGATION = 'gdpr_legal_obligation',
  GDPR_VITAL_INTERESTS = 'gdpr_vital_interests',
  GDPR_PUBLIC_TASK = 'gdpr_public_task',
  GDPR_LEGITIMATE_INTERESTS = 'gdpr_legitimate_interests',
  CCPA_BUSINESS_PURPOSE = 'ccpa_business_purpose',
  CCPA_SERVICE_PROVIDER = 'ccpa_service_provider'
}

export interface IConsentRecord {
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
  retentionPeriod: number; // in days
  thirdParties?: string[];
}

export interface IPrivacySettings {
  // 🇹🇳 Tunisia Base Requirements
  dataProcessingConsent: boolean;
  locationTrackingConsent: boolean;
  communicationConsent: boolean;

  // 🌍 International Extended Settings
  marketingOptIn: boolean;
  analyticsOptIn: boolean;
  thirdPartySharing: boolean;
  profilingOptIn: boolean;
  cookiesConsent: boolean;

  // Consent Records
  consentRecords: IConsentRecord[];

  // Data Subject Rights
  dataPortabilityRequested: boolean;
  deletionRequested: boolean;
  restrictionRequested: boolean;

  // Technical Settings
  lastUpdated: Date;
  consentVersion: string;
}

export interface IDataProcessingRecord {
  // 🇹🇳 Tunisia Documentation Requirements
  processingId: string;
  purpose: string;
  legalBasis: LegalBasis;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  transfersToThirdCountries: boolean;
  retentionPeriod: number;
  securityMeasures: string[];

  // 🌍 International Requirements
  lawfulBasisExplanation: string;
  dataMinimizationMeasures: string[];
  accuracyMeasures: string[];

  // Timestamps
  createdAt: Date;
  lastAssessed: Date;
}

export interface IUserDataExport {
  // Basic Information
  personalData: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    profileImage?: string;
    createdAt: Date;
    lastLoginAt?: Date;
  };

  // Privacy Settings
  privacySettings: IPrivacySettings;

  // Activity Data
  activityData: {
    loginHistory: Array<{
      timestamp: Date;
      ipAddress: string;
      userAgent: string;
      location?: string;
    }>;
    locationHistory?: Array<{
      timestamp: Date;
      latitude: number;
      longitude: number;
      accuracy: number;
    }>;
  };

  // Application Data
  applicationData: {
    orders: Array<{
      orderNumber: string;
      status: string;
      totalAmount: number;
      orderDate?: Date;
    }>;
    favorites: Array<{
      itemName?: string;
      addedAt: Date;
      type: string;
    }>;
    reviews: Array<{
      overallRating: number;
      comment: string;
      createdAt?: Date;
    }>;
    notifications: Array<{
      title: string;
      body: string;
      sentAt?: Date;
      isRead: boolean;
    }>;
  };

  // Metadata
  exportMetadata: {
    requestedAt: Date;
    exportedAt: Date;
    format: 'json' | 'csv' | 'xml';
    version: string;
    legal_notices: {
      tunisia_law: string;
      gdpr_notice: string;
      ccpa_notice: string;
    };
  };
}

export interface IAnonymizationResult {
  userId: string;
  anonymizedAt: Date;
  dataRetained: string[];
  dataAnonymized: string[];
  dataDeleted: string[];
  legalBasis: string;
  retentionPeriodReason?: string;
}

export interface ISystemComplianceOverview {
  tunisiaCompliance: {
    totalUsers: number;
    compliantUsers: number;
    pendingConsents: number;
    complianceRate: number;
    missingDataProcessingConsent: number;
    missingLocationConsent: number;
    missingCommunicationConsent: number;
  };
  internationalCompliance: {
    gdprCompliant: number;
    ccpaCompliant: number;
    pendingRequests: number;
    marketingOptIns: number;
    analyticsOptIns: number;
    thirdPartyConsentGiven: number;
    internationalComplianceRate: number;
  };
  dataSubjectRequests: {
    exportRequests: number;
    deletionRequests: number;
    consentWithdrawals: number;
    restrictionRequests: number;
    objectionRequests: number;
    pendingRequests: number;
    lastExportDate?: Date;
  };
  auditSummary: {
    lastAudit: Date;
    complianceScore: string;
    recommendedActions: string[];
    criticalIssues: number;
    warningIssues: number;
    totalConsentRecords: number;
  };
}