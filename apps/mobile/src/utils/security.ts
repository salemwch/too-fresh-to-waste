import JailMonkey from 'jail-monkey';
import { Alert } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import * as Keychain from 'react-native-keychain';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import TouchID from 'react-native-touch-id';

import { environment } from '@/config/environment';

import { Logger } from './logger';

import type { BiometricResult } from '@/types';
import type { Permission } from 'react-native-permissions';

// Security check results
export interface SecurityCheck {
  isRooted: boolean;
  isJailbroken: boolean;
  isDebuggerAttached: boolean;
  isEmulator: boolean;
  hasHooks: boolean;
  canMockLocation: boolean;
}

// Biometric authentication options
interface BiometricOptions {
  title?: string;
  subtitle?: string;
  description?: string;
  fallbackLabel?: string;
  cancelLabel?: string;
  disableDeviceFallback?: boolean;
}

class SecurityService {
  private securityChecks: SecurityCheck | null = null;
  private readonly KEYCHAIN_SERVICE = 'FoodWasteApp';

  // Device security checks
  public async performSecurityChecks(): Promise<SecurityCheck> {
    try {
      Logger.info('Performing security checks');

      const isEmulator = await DeviceInfo.isEmulator();

      const checks: SecurityCheck = {
        isRooted: JailMonkey.isJailBroken(),
        isJailbroken: JailMonkey.isJailBroken(),
        isDebuggerAttached: await Promise.resolve(JailMonkey.isDebuggedMode()),
        isEmulator,
        hasHooks: JailMonkey.hookDetected(),
        canMockLocation: JailMonkey.canMockLocation(),
      };

      this.securityChecks = checks;

      // Log security issues
      if (checks.isRooted || checks.isJailbroken) {
        Logger.warn('Device security compromised: rooted/jailbroken device detected');
      }

      if (checks.isDebuggerAttached && environment.isProduction) {
        Logger.warn('Debugger detected in production environment');
      }

      if (checks.hasHooks) {
        Logger.warn('Runtime manipulation detected');
      }

      return checks;
    } catch (error) {
      Logger.error('Failed to perform security checks', {}, error as Error);
      throw error;
    }
  }

  public getLastSecurityCheck(): SecurityCheck | null {
    return this.securityChecks;
  }

  public shouldBlockApp(): boolean {
    if (!this.securityChecks || !environment.isProduction) {
      return false;
    }

    const { isRooted, isJailbroken, hasHooks } = this.securityChecks;

    // Block app if device is compromised and security detection is enabled
    return environment.security.rootDetectionEnabled && (isRooted || isJailbroken || hasHooks);
  }

  public showSecurityWarning(): void {
    if (!this.securityChecks) return;

    const { isRooted, isJailbroken, isDebuggerAttached, hasHooks } = this.securityChecks;

    let warningMessage = '';

    if (isRooted || isJailbroken) {
      warningMessage =
        'This device appears to be rooted/jailbroken. The app may not function properly for security reasons.';
    } else if (isDebuggerAttached) {
      warningMessage = 'A debugger is attached to the app. This may pose security risks.';
    } else if (hasHooks) {
      warningMessage = 'Runtime manipulation detected. The app may not function properly.';
    }

    if (warningMessage) {
      Alert.alert(
        'Security Warning',
        warningMessage,
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Continue Anyway',
            style: 'destructive',
            onPress: () => Logger.warn('User chose to continue despite security warning'),
          },
        ],
        { cancelable: false },
      );
    }
  }

  // Biometric authentication
  public async isBiometricSupported(): Promise<boolean> {
    try {
      const biometryType = await TouchID.isSupported();
      return typeof biometryType === 'string';
    } catch (error) {
      Logger.debug('Biometric authentication not supported');
      return false;
    }
  }

  public async getBiometricType(): Promise<string | null> {
    try {
      const biometryType = await TouchID.isSupported();
      return typeof biometryType === 'string' ? biometryType : null;
    } catch (error) {
      Logger.debug('Failed to get biometric type');
      return null;
    }
  }

  public async authenticateWithBiometric(options: BiometricOptions = {}): Promise<BiometricResult> {
    try {
      const defaultOptions = {
        title: 'Authenticate',
        subtitle: 'Use your biometric to authenticate',
        description: 'Place your finger on the fingerprint sensor or look at the camera',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        ...options,
      };

      await TouchID.authenticate(defaultOptions.description, {
        title: defaultOptions.title,
        fallbackLabel: defaultOptions.fallbackLabel,
      });

      Logger.info('Biometric authentication successful');
      const bioType = await this.getBiometricType();
      return {
        success: true,
        biometryType: (bioType as 'TouchID' | 'FaceID' | 'Fingerprint' | 'None') || 'None',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Biometric authentication failed';
      Logger.warn('Biometric authentication failed', { error: errorMessage });

      const bioType = await this.getBiometricType();
      return {
        success: false,
        error: errorMessage,
        biometryType: (bioType as 'TouchID' | 'FaceID' | 'Fingerprint' | 'None') || 'None',
      };
    }
  }

  // Secure storage using Keychain
  public async storeSecureData(
    key: string,
    value: string,
    options?: Keychain.SetOptions,
  ): Promise<boolean> {
    try {
      const defaultOptions: Keychain.SetOptions = {
        service: this.KEYCHAIN_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
        authenticationPrompt: { title: 'Authenticate', subtitle: 'Access secure data' },
        ...options,
      };

      await Keychain.setInternetCredentials(key, key, value, defaultOptions);
      Logger.debug('Secure data stored successfully', { key });
      return true;
    } catch (error) {
      Logger.error('Failed to store secure data', { key }, error as Error);
      return false;
    }
  }

  public async retrieveSecureData(
    key: string,
    options?: Keychain.GetOptions,
  ): Promise<string | null> {
    try {
      const defaultOptions: Keychain.GetOptions = {
        service: this.KEYCHAIN_SERVICE,
        authenticationPrompt: { title: 'Authenticate', subtitle: 'Access secure data' },
        ...options,
      };

      const credentials = await Keychain.getInternetCredentials(key, defaultOptions);

      if (credentials && credentials.password) {
        Logger.debug('Secure data retrieved successfully', { key });
        return credentials.password;
      }

      return null;
    } catch (error) {
      Logger.error('Failed to retrieve secure data', { key }, error as Error);
      return null;
    }
  }

  public async removeSecureData(key: string): Promise<boolean> {
    try {
      await Keychain.resetInternetCredentials(key);
      Logger.debug('Secure data removed successfully', { key });
      return true;
    } catch (error) {
      Logger.error('Failed to remove secure data', { key }, error as Error);
      return false;
    }
  }

  public async clearAllSecureData(): Promise<boolean> {
    try {
      await Keychain.resetInternetCredentials(this.KEYCHAIN_SERVICE);
      Logger.info('All secure data cleared');
      return true;
    } catch (error) {
      Logger.error('Failed to clear secure data', {}, error as Error);
      return false;
    }
  }

  // Permission management
  public async checkPermission(permission: Permission): Promise<string> {
    try {
      const result = await check(permission);
      Logger.debug('Permission checked', { permission, result });
      return result;
    } catch (error) {
      Logger.error('Failed to check permission', { permission }, error as Error);
      return RESULTS.UNAVAILABLE;
    }
  }

  public async requestPermission(permission: Permission): Promise<string> {
    try {
      const result = await request(permission);
      Logger.info('Permission requested', { permission, result });
      return result;
    } catch (error) {
      Logger.error('Failed to request permission', { permission }, error as Error);
      return RESULTS.UNAVAILABLE;
    }
  }

  public async ensurePermission(permission: Permission): Promise<boolean> {
    try {
      let result = await this.checkPermission(permission);

      if (result === RESULTS.DENIED || result === RESULTS.BLOCKED) {
        result = await this.requestPermission(permission);
      }

      return result === RESULTS.GRANTED;
    } catch (error) {
      Logger.error('Failed to ensure permission', { permission }, error as Error);
      return false;
    }
  }

  // Input validation and sanitization
  public sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .slice(0, 1000); // Limit length
  }

  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-()]{8,}$/;
    return phoneRegex.test(phone);
  }

  public validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain lowercase letters');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain uppercase letters');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      feedback.push('Password must contain numbers');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('Password must contain special characters');
    } else {
      score += 1;
    }

    return {
      isValid: feedback.length === 0,
      score,
      feedback,
    };
  }

  // Certificate pinning (placeholder for implementation)
  public async validateCertificate(hostname: string, _certificate: string): Promise<boolean> {
    if (!environment.security.certificatePinningEnabled) {
      return true;
    }

    // Implementation would depend on specific certificate pinning library
    // This is a placeholder for the actual certificate validation logic
    Logger.debug('Certificate validation requested', { hostname });

    // For now, return true, but in production this should validate against pinned certificates
    return true;
  }

  // Generate secure random values
  public generateSecureRandom(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return result;
  }

  // Hash data (for client-side hashing, not passwords)
  public async hashData(data: string): Promise<string> {
    // Simple hash implementation for client-side data integrity
    // Not suitable for password hashing
    let hash = 0;

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }
}

// Create and export singleton instance
export const securityService = new SecurityService();

// Common permission constants
export const APP_PERMISSIONS = {
  LOCATION: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  CAMERA: PERMISSIONS.ANDROID.CAMERA,
  STORAGE: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
  // POST_NOTIFICATIONS requires Android 13+ (API 33+)
  NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' as Permission,
} as const;
