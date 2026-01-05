/**
 * Biometric Authentication Service
 * TouchID (iOS) / Fingerprint & Face Unlock (Android)
 * Uses react-native-touch-id for biometric authentication
 */

import { Platform } from 'react-native';
import TouchID from 'react-native-touch-id';

import { Logger } from '@/utils/logger';

/**
 * Biometric types supported
 */
export enum BiometricType {
  TOUCH_ID = 'TouchID',
  FACE_ID = 'FaceID',
  FINGERPRINT = 'Fingerprint',
  FACE_UNLOCK = 'Face',
  NONE = 'None',
}

/**
 * Biometric error codes
 */
export enum BiometricError {
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

export interface BiometricAuthResult {
  success: boolean;
  error?: BiometricError;
  biometricType?: BiometricType;
  errorMessage?: string;
}

export class BiometricAuth {
  /**
   * Check if biometric authentication is supported on device
   */
  static async isSupported(): Promise<BiometricAuthResult> {
    try {
      const biometryType = await TouchID.isSupported();

      let type: BiometricType = BiometricType.NONE;

      if (typeof biometryType === 'string') {
        // Map TouchID library types to our enum
        const biometryTypeStr = biometryType as string;
        switch (biometryTypeStr) {
          case 'TouchID':
            type = BiometricType.TOUCH_ID;
            break;
          case 'FaceID':
            type = BiometricType.FACE_ID;
            break;
          case 'Fingerprint':
          case BiometricType.FINGERPRINT:
            type = BiometricType.FINGERPRINT;
            break;
          case 'Face':
          case BiometricType.FACE_UNLOCK:
            type = BiometricType.FACE_UNLOCK;
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

      // Configure authentication options
      const optionalConfigObject = {
        title: 'Authentication Required',
        imageColor: '#e00606', // Android only
        imageErrorColor: '#ff0000', // Android only
        sensorDescription: 'Touch sensor', // Android only
        sensorErrorDescription: 'Failed', // Android only
        cancelText: 'Cancel', // Android only
        fallbackLabel: 'Show Passcode', // iOS only, shows the device passcode after failed biometric
        unifiedErrors: false, // Use unified error messages
        passcodeFallback: false, // iOS only - don't allow fallback to passcode
      };

      await TouchID.authenticate(reason, optionalConfigObject);

      Logger.info('Biometric authentication successful');

      // Conditional spreading for exactOptionalPropertyTypes compliance
      return {
        success: true,
        ...(supportCheck.biometricType && { biometricType: supportCheck.biometricType }),
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

    // Map TouchID error codes to our BiometricError enum
    let mappedError: BiometricError;

    switch (errorCode) {
      case 'LAErrorAuthenticationFailed': // iOS
      case 'AUTHENTICATION_FAILED': // Android
        mappedError = BiometricError.AUTHENTICATION_FAILED;
        break;

      case 'LAErrorUserCancel': // iOS
      case 'USER_CANCELED': // Android
        mappedError = BiometricError.USER_CANCEL;
        break;

      case 'LAErrorSystemCancel': // iOS
      case 'SYSTEM_CANCELED': // Android
        mappedError = BiometricError.SYSTEM_CANCEL;
        break;

      case 'LAErrorBiometryNotAvailable': // iOS
      case 'NOT_AVAILABLE': // Android
        mappedError = BiometricError.NOT_SUPPORTED;
        break;

      case 'LAErrorBiometryNotEnrolled': // iOS
      case 'NOT_ENROLLED': // Android
        mappedError = BiometricError.NOT_ENROLLED;
        break;

      case 'LAErrorPasscodeNotSet': // iOS
      case 'PASSCODE_NOT_SET': // Android
        mappedError = BiometricError.PASSCODE_NOT_SET;
        break;

      case 'LAErrorBiometryLockout': // iOS
      case 'BIOMETRIC_LOCKOUT': // Android
        mappedError = BiometricError.BIOMETRIC_LOCKOUT;
        break;

      case 'BIOMETRIC_ERROR_LOCKOUT_PERMANENT': // Android
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

    // In a real app, you'd show a modal/alert here asking user
    // if they want to enable biometric for future logins
    return true;
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
      default:
        return 'Biometric';
    }
  }
}
