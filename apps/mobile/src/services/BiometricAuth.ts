/**
 * Biometric Authentication Service
 * TouchID (iOS) / Fingerprint & Face Unlock (Android)
 * Uses react-native-keychain for biometric authentication (New Architecture compatible)
 */

import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

import { Logger } from '@/utils/logger';

/**
 * Biometric types supported
 */
export enum BiometricType {
  TOUCH_ID = 'TouchID',
  FACE_ID = 'FaceID',
  FINGERPRINT = 'Fingerprint',
  FACE_UNLOCK = 'Face',
  IRIS = 'Iris',
  NONE = 'None',
}

/**
 * Biometric error codes
 */
enum BiometricError {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_ENROLLED = 'NOT_ENROLLED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  USER_CANCEL = 'USER_CANCEL',
  SYSTEM_CANCEL = 'SYSTEM_CANCEL',
  PASSCODE_NOT_SET = 'PASSCODE_NOT_SET',
  BIOMETRIC_LOCKOUT = 'BIOMETRIC_LOCKOUT',
  BIOMETRIC_LOCKOUT_PERMANENT = 'BIOMETRIC_LOCKOUT_PERMANENT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

interface BiometricAuthResult {
  success: boolean;
  error?: BiometricError;
  biometricType?: BiometricType;
  errorMessage?: string;
}

// Internal key used for biometric authentication verification
const BIOMETRIC_AUTH_KEY = 'biometric_auth_verification';
const BIOMETRIC_AUTH_SERVICE = 'FoodWasteApp_BiometricAuth';

export class BiometricAuth {
  /**
   * Check if biometric authentication is supported on device
   */
  static async isSupported(): Promise<BiometricAuthResult> {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();

      let type: BiometricType = BiometricType.NONE;

      if (biometryType) {
        switch (biometryType) {
          case Keychain.BIOMETRY_TYPE.TOUCH_ID:
            type = BiometricType.TOUCH_ID;
            break;
          case Keychain.BIOMETRY_TYPE.FACE_ID:
            type = BiometricType.FACE_ID;
            break;
          case Keychain.BIOMETRY_TYPE.FINGERPRINT:
            type = BiometricType.FINGERPRINT;
            break;
          case Keychain.BIOMETRY_TYPE.FACE:
            type = BiometricType.FACE_UNLOCK;
            break;
          case Keychain.BIOMETRY_TYPE.IRIS:
            type = BiometricType.IRIS;
            break;
          default:
            type = BiometricType.NONE;
        }
      }

      Logger.info(`Biometric type supported: ${type}`);

      return {
        success: type !== BiometricType.NONE,
        biometricType: type,
      };
    } catch (error: any) {
      Logger.warn('Biometric not supported', { error: error?.message });

      return {
        success: false,
        error: BiometricError.NOT_SUPPORTED,
        errorMessage: 'Biometric authentication is not supported on this device',
      };
    }
  }

  /**
   * Initialize biometric authentication by storing a verification key
   * This must be called once before authenticate() can work
   */
  static async initialize(): Promise<boolean> {
    try {
      const supportCheck = await this.isSupported();
      if (!supportCheck.success) {
        return false;
      }

      // Store a verification key that requires biometric to access
      await Keychain.setGenericPassword(BIOMETRIC_AUTH_KEY, 'biometric_enabled', {
        service: BIOMETRIC_AUTH_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });

      Logger.info('Biometric authentication initialized');
      return true;
    } catch (error: any) {
      Logger.warn('Failed to initialize biometric auth', { error: error?.message });
      return false;
    }
  }

  /**
   * Authenticate user with biometric
   */
  static async authenticate(
    reason: string = 'Authenticate to access your account',
  ): Promise<BiometricAuthResult> {
    try {
      // Check if biometric is supported first
      const supportCheck = await this.isSupported();
      if (!supportCheck.success) {
        return supportCheck;
      }

      // Try to retrieve the verification key using biometric
      const credentials = await Keychain.getGenericPassword({
        service: BIOMETRIC_AUTH_SERVICE,
        authenticationPrompt: {
          title: 'Authentication Required',
          subtitle: reason,
          description:
            Platform.select({
              ios: 'Use Face ID or Touch ID to authenticate',
              android: 'Use your fingerprint or face to authenticate',
            }) ?? 'Use biometric authentication',
          cancel: 'Cancel',
        },
      });

      if (credentials) {
        Logger.info('Biometric authentication successful');
        return {
          success: true,
          ...(supportCheck.biometricType && { biometricType: supportCheck.biometricType }),
        };
      }

      // If no credentials found, initialize and try again
      const initialized = await this.initialize();
      if (initialized) {
        // Retry authentication after initialization
        const retryCredentials = await Keychain.getGenericPassword({
          service: BIOMETRIC_AUTH_SERVICE,
          authenticationPrompt: {
            title: 'Authentication Required',
            subtitle: reason,
            cancel: 'Cancel',
          },
        });

        if (retryCredentials) {
          Logger.info('Biometric authentication successful after initialization');
          return {
            success: true,
            ...(supportCheck.biometricType && { biometricType: supportCheck.biometricType }),
          };
        }
      }

      return {
        success: false,
        error: BiometricError.AUTHENTICATION_FAILED,
        errorMessage: 'Biometric authentication failed',
      };
    } catch (error: any) {
      const errorResult = this.handleBiometricError(error);
      Logger.warn('Biometric authentication failed', {
        error: errorResult.error,
        message: errorResult.errorMessage,
      });
      return errorResult;
    }
  }

  /**
   * Handle biometric errors and map to our error types
   */
  private static handleBiometricError(error: any): BiometricAuthResult {
    const errorCode = error.code || error.name;
    const errorMessage = error.message || 'Unknown error occurred';

    let mappedError: BiometricError;

    // Map Keychain error codes to our BiometricError enum
    switch (errorCode) {
      case '-1': // Authentication failed
      case 'AuthenticationFailed':
        mappedError = BiometricError.AUTHENTICATION_FAILED;
        break;

      case '-2': // User canceled
      case 'UserCancel':
        mappedError = BiometricError.USER_CANCEL;
        break;

      case '-4': // System canceled
      case 'SystemCancel':
        mappedError = BiometricError.SYSTEM_CANCEL;
        break;

      case '-6': // Biometry not available
      case 'BiometryNotAvailable':
        mappedError = BiometricError.NOT_SUPPORTED;
        break;

      case '-7': // Biometry not enrolled
      case 'BiometryNotEnrolled':
        mappedError = BiometricError.NOT_ENROLLED;
        break;

      case '-5': // Passcode not set
      case 'PasscodeNotSet':
        mappedError = BiometricError.PASSCODE_NOT_SET;
        break;

      case '-8': // Biometry lockout
      case 'BiometryLockout':
        mappedError = BiometricError.BIOMETRIC_LOCKOUT;
        break;

      case '-9': // Biometry permanent lockout
      case 'BiometryLockoutPermanent':
        mappedError = BiometricError.BIOMETRIC_LOCKOUT_PERMANENT;
        break;

      default:
        mappedError = BiometricError.UNKNOWN_ERROR;
    }

    return {
      success: false,
      error: mappedError,
      errorMessage: this.getErrorMessage(mappedError, errorMessage),
    };
  }

  /**
   * Get user-friendly error messages
   */
  private static getErrorMessage(error: BiometricError, originalMessage: string): string {
    switch (error) {
      case BiometricError.NOT_SUPPORTED:
        return 'Biometric authentication is not available on this device';

      case BiometricError.NOT_ENROLLED:
        return (
          Platform.select({
            ios: 'No Face ID or Touch ID enrolled. Please set up biometric authentication in Settings.',
            android:
              'No fingerprint enrolled. Please set up fingerprint authentication in Settings.',
          }) || 'Biometric authentication not set up'
        );

      case BiometricError.AUTHENTICATION_FAILED:
        return 'Authentication failed. Please try again.';

      case BiometricError.USER_CANCEL:
        return 'Authentication cancelled by user';

      case BiometricError.SYSTEM_CANCEL:
        return 'Authentication cancelled by system';

      case BiometricError.PASSCODE_NOT_SET:
        return 'Passcode not set. Please set up a device passcode first.';

      case BiometricError.BIOMETRIC_LOCKOUT:
        return 'Too many failed attempts. Please try again later or use your passcode.';

      case BiometricError.BIOMETRIC_LOCKOUT_PERMANENT:
        return 'Biometric authentication is locked. Please unlock your device.';

      case BiometricError.UNKNOWN_ERROR:
      default:
        return originalMessage || 'An unknown error occurred';
    }
  }

  /**
   * Prompt user to enable biometric after successful login
   */
  static async promptToEnable(): Promise<boolean> {
    const supportCheck = await this.isSupported();

    if (!supportCheck.success) {
      return false;
    }

    // Initialize biometric auth for future use
    return this.initialize();
  }

  /**
   * Disable biometric authentication
   */
  static async disable(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: BIOMETRIC_AUTH_SERVICE });
      Logger.info('Biometric authentication disabled');
      return true;
    } catch (error: any) {
      Logger.warn('Failed to disable biometric auth', { error: error?.message });
      return false;
    }
  }

  /**
   * Check if biometric authentication is enabled for this app
   */
  static async isEnabled(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: BIOMETRIC_AUTH_SERVICE,
      });
      return !!credentials;
    } catch {
      return false;
    }
  }

  /**
   * Get biometric type display name
   */
  static getBiometricTypeName(type: BiometricType): string {
    switch (type) {
      case BiometricType.TOUCH_ID:
        return 'Touch ID';
      case BiometricType.FACE_ID:
        return 'Face ID';
      case BiometricType.FINGERPRINT:
        return 'Fingerprint';
      case BiometricType.FACE_UNLOCK:
        return 'Face Unlock';
      case BiometricType.IRIS:
        return 'Iris Scanner';
      default:
        return 'Biometric';
    }
  }
}
