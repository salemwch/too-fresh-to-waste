import { environment } from './environment';

// Security configuration and policies
export interface SecurityPolicy {
  readonly authentication: {
    readonly maxLoginAttempts: number;
    readonly lockoutDurationMinutes: number;
    readonly sessionTimeoutMinutes: number;
    readonly requireMFA: boolean;
    readonly passwordMinLength: number;
    readonly passwordRequireUppercase: boolean;
    readonly passwordRequireLowercase: boolean;
    readonly passwordRequireNumbers: boolean;
    readonly passwordRequireSpecialChars: boolean;
    readonly passwordExpirationDays?: number;
    readonly preventPasswordReuse: number;
  };
  readonly network: {
    readonly enableCertificatePinning: boolean;
    readonly allowUnsecureConnections: boolean;
    readonly enableRequestSigning: boolean;
    readonly maxRetryAttempts: number;
    readonly timeoutSeconds: number;
    readonly enableResponseValidation: boolean;
    readonly trustedDomains: string[];
  };
  readonly storage: {
    readonly enableEncryption: boolean;
    readonly encryptSensitiveData: boolean;
    readonly enableBiometricAuth: boolean;
    readonly maxCacheAge: number;
    readonly autoDeleteAfterDays: number;
    readonly enableBackup: boolean;
  };
  readonly runtime: {
    readonly enableRootDetection: boolean;
    readonly enableDebugDetection: boolean;
    readonly enableTamperDetection: boolean;
    readonly enableScreenshotPrevention: boolean;
    readonly enableAppAttestationCheck: boolean;
    readonly allowEmulators: boolean;
  };
  readonly privacy: {
    readonly enableDataMinimization: boolean;
    readonly enableConsentManagement: boolean;
    readonly enableRightToErasure: boolean;
    readonly dataRetentionDays: number;
    readonly enableAnonymization: boolean;
    readonly restrictDataProcessing: boolean;
  };
}

// Development security policy (relaxed for development)
const developmentPolicy: SecurityPolicy = {
  authentication: {
    maxLoginAttempts: 10,
    lockoutDurationMinutes: 5,
    sessionTimeoutMinutes: 480, // 8 hours
    requireMFA: false,
    passwordMinLength: 6,
    passwordRequireUppercase: false,
    passwordRequireLowercase: true,
    passwordRequireNumbers: false,
    passwordRequireSpecialChars: false,
    preventPasswordReuse: 0,
  },
  network: {
    enableCertificatePinning: false,
    allowUnsecureConnections: true,
    enableRequestSigning: false,
    maxRetryAttempts: 3,
    timeoutSeconds: 30,
    enableResponseValidation: false,
    trustedDomains: ['localhost', '127.0.0.1', '10.0.2.2'],
  },
  storage: {
    enableEncryption: false,
    encryptSensitiveData: true,
    enableBiometricAuth: true,
    maxCacheAge: 86400000, // 24 hours
    autoDeleteAfterDays: 90,
    enableBackup: true,
  },
  runtime: {
    enableRootDetection: false,
    enableDebugDetection: false,
    enableTamperDetection: false,
    enableScreenshotPrevention: false,
    enableAppAttestationCheck: false,
    allowEmulators: true,
  },
  privacy: {
    enableDataMinimization: true,
    enableConsentManagement: true,
    enableRightToErasure: true,
    dataRetentionDays: 365,
    enableAnonymization: false,
    restrictDataProcessing: false,
  },
};

// Staging security policy (moderate security)
const stagingPolicy: SecurityPolicy = {
  authentication: {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    sessionTimeoutMinutes: 120, // 2 hours
    requireMFA: true,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordExpirationDays: 90,
    preventPasswordReuse: 3,
  },
  network: {
    enableCertificatePinning: true,
    allowUnsecureConnections: false,
    enableRequestSigning: true,
    maxRetryAttempts: 2,
    timeoutSeconds: 15,
    enableResponseValidation: true,
    trustedDomains: ['api-staging.foodwaste.com'],
  },
  storage: {
    enableEncryption: true,
    encryptSensitiveData: true,
    enableBiometricAuth: true,
    maxCacheAge: 3600000, // 1 hour
    autoDeleteAfterDays: 30,
    enableBackup: false,
  },
  runtime: {
    enableRootDetection: true,
    enableDebugDetection: true,
    enableTamperDetection: true,
    enableScreenshotPrevention: true,
    enableAppAttestationCheck: true,
    allowEmulators: false,
  },
  privacy: {
    enableDataMinimization: true,
    enableConsentManagement: true,
    enableRightToErasure: true,
    dataRetentionDays: 365,
    enableAnonymization: true,
    restrictDataProcessing: false,
  },
};

// Production security policy (maximum security)
const productionPolicy: SecurityPolicy = {
  authentication: {
    maxLoginAttempts: 3,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 60, // 1 hour
    requireMFA: true,
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordExpirationDays: 60,
    preventPasswordReuse: 5,
  },
  network: {
    enableCertificatePinning: true,
    allowUnsecureConnections: false,
    enableRequestSigning: true,
    maxRetryAttempts: 2,
    timeoutSeconds: 10,
    enableResponseValidation: true,
    trustedDomains: ['api.foodwaste.com'],
  },
  storage: {
    enableEncryption: true,
    encryptSensitiveData: true,
    enableBiometricAuth: true,
    maxCacheAge: 1800000, // 30 minutes
    autoDeleteAfterDays: 7,
    enableBackup: false,
  },
  runtime: {
    enableRootDetection: true,
    enableDebugDetection: true,
    enableTamperDetection: true,
    enableScreenshotPrevention: true,
    enableAppAttestationCheck: true,
    allowEmulators: false,
  },
  privacy: {
    enableDataMinimization: true,
    enableConsentManagement: true,
    enableRightToErasure: true,
    dataRetentionDays: 365,
    enableAnonymization: true,
    restrictDataProcessing: true,
  },
};

// Get security policy based on environment
export const getSecurityPolicy = (): SecurityPolicy => {
  switch (environment.environment) {
    case 'development':
      return developmentPolicy;
    case 'staging':
      return stagingPolicy;
    case 'production':
      return productionPolicy;
    default:
      return developmentPolicy;
  }
};

// Current security policy
export const securityPolicy = getSecurityPolicy();

// Security headers for API requests
export const getSecurityHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  // Add app-specific headers
  headers['X-App-Version'] = environment.app.version;
  headers['X-App-Platform'] = 'mobile';
  headers['X-Requested-With'] = 'XMLHttpRequest';

  return headers;
};

// Content Security Policy for WebViews
export const getContentSecurityPolicy = (): string => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https:",
    "connect-src 'self' https:",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];

  return csp.join('; ');
};

// Trusted certificate fingerprints (for certificate pinning)
export const getTrustedCertificates = (): Record<string, string[]> =>
  // These would be the actual SHA-256 fingerprints of your API certificates
  ({
    'api.foodwaste.com': [
      // Primary certificate fingerprint
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      // Backup certificate fingerprint
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    ],
    'api-staging.foodwaste.com': ['CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC='],
  });

// Rate limiting configuration
export const rateLimitConfig = {
  // General API calls
  api: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  // Authentication attempts
  auth: {
    maxRequests: 5,
    windowMs: 900000, // 15 minutes
  },
  // Password reset requests
  passwordReset: {
    maxRequests: 3,
    windowMs: 3600000, // 1 hour
  },
  // File uploads
  upload: {
    maxRequests: 10,
    windowMs: 300000, // 5 minutes
  },
};

// Sensitive data fields that should be excluded from logs
export const sensitiveFields = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'ssn',
  'creditcard',
  'cvv',
  'pin',
  'otp',
  'mfa',
  'biometric',
];

// Data classification levels
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
}

// Field-level data classification
export const dataClassification: Record<string, DataClassification> = {
  // User data
  email: DataClassification.CONFIDENTIAL,
  phone: DataClassification.CONFIDENTIAL,
  firstName: DataClassification.INTERNAL,
  lastName: DataClassification.INTERNAL,
  location: DataClassification.CONFIDENTIAL,
  address: DataClassification.CONFIDENTIAL,
  paymentInfo: DataClassification.RESTRICTED,

  // System data
  userId: DataClassification.INTERNAL,
  sessionId: DataClassification.RESTRICTED,
  deviceId: DataClassification.INTERNAL,
  ipAddress: DataClassification.CONFIDENTIAL,

  // Business data
  orderInfo: DataClassification.CONFIDENTIAL,
  offerInfo: DataClassification.INTERNAL,
  establishmentInfo: DataClassification.INTERNAL,
  analyticsData: DataClassification.INTERNAL,
};

// Export utility functions
export const isProductionEnvironment = (): boolean => environment.isProduction;
export const isSensitiveField = (fieldName: string): boolean =>
  sensitiveFields.some(field => fieldName.toLowerCase().includes(field));
export const getDataClassification = (fieldName: string): DataClassification =>
  dataClassification[fieldName] || DataClassification.INTERNAL;
