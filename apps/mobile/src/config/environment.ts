import Config from 'react-native-config';

interface EnvironmentConfig {
  readonly app: {
    readonly name: string;
    readonly version: string;
    readonly bundleIdentifier: string;
  };
  readonly environment: 'development' | 'staging' | 'production';
  readonly api: {
    readonly baseUrl: string;
    readonly websocketUrl: string;
    readonly timeout: number;
    readonly retryCount: number;
  };
  readonly auth: {
    readonly jwtRefreshThreshold: number;
    readonly sessionTimeout: number;
  };
  readonly firebase: {
    readonly apiKey: string;
    readonly authDomain: string;
    readonly projectId: string;
    readonly storageBucket: string;
    readonly messagingSenderId: string;
    readonly appId: string;
  };
  readonly maps: {
    readonly googleMapsApiKey: string;
  };
  readonly monitoring: {
    readonly enableAnalytics: boolean;
    readonly enableCrashlytics: boolean;
    readonly enablePerformanceMonitoring: boolean;
    readonly enableFlipper: boolean;
    readonly enableReactotron: boolean;
  };
  readonly security: {
    readonly certificatePinningEnabled: boolean;
    readonly rootDetectionEnabled: boolean;
    readonly debugDetectionEnabled: boolean;
  };
  readonly features: {
    readonly biometricAuth: boolean;
    readonly pushNotifications: boolean;
    readonly locationServices: boolean;
    readonly offlineMode: boolean;
    readonly darkMode: boolean;
  };
  readonly debug: {
    readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
    readonly enableNetworkLogging: boolean;
    readonly enableReduxLogging: boolean;
    readonly enableNativeModuleLogging: boolean;
  };
  readonly storage: {
    readonly encryptionKey: string;
    readonly cacheSizeLimit: number;
  };
  readonly geolocation: {
    readonly defaultLatitude: number;
    readonly defaultLongitude: number;
    readonly accuracyThreshold: number;
  };
  // Utility methods
  readonly isProduction: boolean;
  readonly shouldEnableDebugging: boolean;
}

const createEnvironmentConfig = (): EnvironmentConfig => {
  const getBoolean = (value: string | undefined, defaultValue = false): boolean => {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  const getNumber = (value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const getString = (value: string | undefined, defaultValue: string): string =>
    value || defaultValue;

  const getLogLevel = (value: string | undefined): 'debug' | 'info' | 'warn' | 'error' => {
    const level = value?.toLowerCase();
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
      return level;
    }
    return 'info';
  };

  const getEnvironment = (value: string | undefined): 'development' | 'staging' | 'production' => {
    const env = value?.toLowerCase();
    if (env === 'development' || env === 'staging' || env === 'production') {
      return env;
    }
    return 'development';
  };

  const env = getEnvironment(Config['ENVIRONMENT']);
  const isProductionEnv = env === 'production';
  const isDevelopmentEnv = env === 'development';
  const isStagingEnv = env === 'staging';

  return {
    app: {
      name: getString(Config['APP_NAME'], 'Too Fresh To Waste'),
      version: getString(Config['APP_VERSION'], '1.0.0'),
      bundleIdentifier: getString(Config['BUNDLE_IDENTIFIER'], 'com.foodwaste.app'),
    },
    environment: env,
    api: {
      baseUrl: getString(Config['API_BASE_URL'], 'http://localhost:3000/api/v1'),
      websocketUrl: getString(Config['WEBSOCKET_URL'], 'ws://localhost:3000'),
      timeout: getNumber(Config['API_TIMEOUT'], 10000),
      retryCount: getNumber(Config['API_RETRY_COUNT'], 3),
    },
    auth: {
      jwtRefreshThreshold: getNumber(Config['JWT_REFRESH_THRESHOLD'], 300000),
      sessionTimeout: getNumber(Config['SESSION_TIMEOUT'], 3600000),
    },
    firebase: {
      apiKey: getString(Config['FIREBASE_API_KEY'], ''),
      authDomain: getString(Config['FIREBASE_AUTH_DOMAIN'], ''),
      projectId: getString(Config['FIREBASE_PROJECT_ID'], ''),
      storageBucket: getString(Config['FIREBASE_STORAGE_BUCKET'], ''),
      messagingSenderId: getString(Config['FIREBASE_MESSAGING_SENDER_ID'], ''),
      appId: getString(Config['FIREBASE_APP_ID'], ''),
    },
    maps: {
      googleMapsApiKey: getString(Config['GOOGLE_MAPS_API_KEY'], ''),
    },
    monitoring: {
      enableAnalytics: getBoolean(Config['ENABLE_ANALYTICS'], false),
      enableCrashlytics: getBoolean(Config['ENABLE_CRASHLYTICS'], false),
      enablePerformanceMonitoring: getBoolean(Config['ENABLE_PERFORMANCE_MONITORING'], false),
      enableFlipper: getBoolean(Config['ENABLE_FLIPPER'], false),
      enableReactotron: getBoolean(Config['ENABLE_REACTOTRON'], false),
    },
    security: {
      certificatePinningEnabled: getBoolean(Config['CERTIFICATE_PINNING_ENABLED'], false),
      rootDetectionEnabled: getBoolean(Config['ROOT_DETECTION_ENABLED'], false),
      debugDetectionEnabled: getBoolean(Config['DEBUG_DETECTION_ENABLED'], false),
    },
    features: {
      biometricAuth: getBoolean(Config['FEATURE_BIOMETRIC_AUTH'], true),
      pushNotifications: getBoolean(Config['FEATURE_PUSH_NOTIFICATIONS'], true),
      locationServices: getBoolean(Config['FEATURE_LOCATION_SERVICES'], true),
      offlineMode: getBoolean(Config['FEATURE_OFFLINE_MODE'], true),
      darkMode: getBoolean(Config['FEATURE_DARK_MODE'], true),
    },
    debug: {
      logLevel: getLogLevel(Config['LOG_LEVEL']),
      enableNetworkLogging: getBoolean(Config['ENABLE_NETWORK_LOGGING'], false),
      enableReduxLogging: getBoolean(Config['ENABLE_REDUX_LOGGING'], false),
      enableNativeModuleLogging: getBoolean(Config['ENABLE_NATIVE_MODULE_LOGGING'], __DEV__),
    },
    storage: {
      encryptionKey: getString(Config['STORAGE_ENCRYPTION_KEY'], 'default-key'),
      cacheSizeLimit: getNumber(Config['CACHE_SIZE_LIMIT'], 50),
    },
    geolocation: {
      defaultLatitude: getNumber(Config['DEFAULT_LOCATION_LATITUDE'], 36.8065),
      defaultLongitude: getNumber(Config['DEFAULT_LOCATION_LONGITUDE'], 10.1815),
      accuracyThreshold: getNumber(Config['LOCATION_ACCURACY_THRESHOLD'], 100),
    },
    // Computed utility properties
    isProduction: isProductionEnv,
    shouldEnableDebugging:
      isDevelopmentEnv || (isStagingEnv && getBoolean(Config['ENABLE_FLIPPER'], false)),
  };
};

export const environment = createEnvironmentConfig();

// Debug logging for environment configuration
if (__DEV__) {
  console.log('[Environment] API Configuration:', {
    baseUrl: environment.api.baseUrl,
    websocketUrl: environment.api.websocketUrl,
    timeout: environment.api.timeout,
    rawConfigValue: Config['API_BASE_URL'],
  });
}

// Type guard for environment checking
export const isDevelopment = (): boolean => environment.environment === 'development';
export const isStaging = (): boolean => environment.environment === 'staging';
const isProduction = (): boolean => environment.isProduction;

// Security checks
export const isDebugBuild = (): boolean => __DEV__ || environment.environment === 'development';

export const shouldEnableDebugging = (): boolean => environment.shouldEnableDebugging;

// Validation function
export const validateEnvironmentConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required fields validation
  if (!environment.firebase.apiKey && environment.monitoring.enableAnalytics) {
    errors.push('Firebase API key is required when analytics is enabled');
  }

  if (!environment.maps.googleMapsApiKey && environment.features.locationServices) {
    errors.push('Google Maps API key is required when location services are enabled');
  }

  if (environment.api.timeout < 1000) {
    errors.push('API timeout should be at least 1000ms');
  }

  if (environment.api.retryCount < 0 || environment.api.retryCount > 5) {
    errors.push('API retry count should be between 0 and 5');
  }

  // Security validation for production
  if (isProduction()) {
    if (!environment.security.certificatePinningEnabled) {
      errors.push('Certificate pinning should be enabled in production');
    }

    if (!environment.security.rootDetectionEnabled) {
      errors.push('Root detection should be enabled in production');
    }

    if (environment.debug.logLevel === 'debug') {
      errors.push('Debug log level should not be used in production');
    }

    if (
      environment.storage.encryptionKey === 'default-key' ||
      environment.storage.encryptionKey.startsWith('REPLACE_WITH')
    ) {
      errors.push(
        'STORAGE_ENCRYPTION_KEY is still a placeholder. Generate a secure key: openssl rand -base64 32',
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Note: shouldEnableDebugging and isProduction are now available as properties on the environment object

// Export default for easy importing
