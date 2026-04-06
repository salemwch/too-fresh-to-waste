# Permission Request Helper - Implementation Guide

**Last Updated:** October 18, 2025 **For:** React Native 0.81.0 with TypeScript
**Library:** react-native-permissions ^5.1.2 **Source:**
https://developer.android.com/training/permissions/requesting

---

## Overview

This guide provides production-ready permission request helpers for the Food
Waste Mobile App. These utilities follow Android best practices, OWASP Mobile
Security guidelines, and provide excellent user experience.

---

## Installation

The permission library is already installed:

```json
{
  "dependencies": {
    "react-native-permissions": "^5.1.2"
  }
}
```

**Configuration:** Already set up in AndroidManifest.xml and iOS Info.plist

---

## Core Permission Helper

**Location:** Create `src/utils/permissions.ts`

```typescript
/**
 * Permission Request Utilities
 * Enterprise-grade permission handling with proper UX and error handling
 *
 * Features:
 * - Just-in-time permission requests
 * - User-friendly rationale dialogs
 * - Graceful degradation
 * - Settings navigation for blocked permissions
 * - TypeScript type safety
 *
 * @see https://developer.android.com/training/permissions/requesting
 * @see https://github.com/zoontek/react-native-permissions
 */

import { Alert, Linking, Platform } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  Permission,
  PermissionStatus,
} from 'react-native-permissions';

/**
 * Permission request result with user-friendly status
 */
export interface PermissionResult {
  granted: boolean;
  status: PermissionStatus;
  canAskAgain: boolean;
  shouldShowSettings: boolean;
}

/**
 * Rationale dialog configuration
 */
export interface PermissionRationale {
  title: string;
  message: string;
  buttonPositive?: string;
  buttonNegative?: string;
}

/**
 * Check if permission is granted
 * Use before requesting to avoid unnecessary dialogs
 */
export async function checkPermission(permission: Permission): Promise<PermissionResult> {
  const status = await check(permission);

  return {
    granted: status === RESULTS.GRANTED,
    status,
    canAskAgain: status === RESULTS.DENIED,
    shouldShowSettings: status === RESULTS.BLOCKED,
  };
}

/**
 * Request permission with automatic rationale and settings navigation
 *
 * @param permission - The permission to request
 * @param rationale - Optional rationale to show before requesting
 * @returns Permission result with actionable status
 *
 * @example
 * const result = await requestPermission(
 *   PERMISSIONS.ANDROID.CAMERA,
 *   {
 *     title: 'Camera Access',
 *     message: 'We need camera access to take photos of food items',
 *   }
 * );
 *
 * if (result.granted) {
 *   // Permission granted, proceed
 *   launchCamera();
 * } else if (result.shouldShowSettings) {
 *   // User blocked permission, already shown settings dialog
 * } else {
 *   // User denied permission, can retry later
 * }
 */
export async function requestPermission(
  permission: Permission,
  rationale?: PermissionRationale,
): Promise<PermissionResult> {
  // Check current status
  const currentStatus = await checkPermission(permission);

  // Already granted
  if (currentStatus.granted) {
    return currentStatus;
  }

  // Permanently blocked - navigate to settings
  if (currentStatus.shouldShowSettings) {
    showSettingsDialog(rationale?.title || 'Permission Required');
    return currentStatus;
  }

  // Show rationale if provided
  if (rationale) {
    const shouldRequest = await showRationaleDialog(rationale);
    if (!shouldRequest) {
      return {
        granted: false,
        status: RESULTS.DENIED,
        canAskAgain: true,
        shouldShowSettings: false,
      };
    }
  }

  // Request permission
  const status = await request(permission);

  const result: PermissionResult = {
    granted: status === RESULTS.GRANTED,
    status,
    canAskAgain: status === RESULTS.DENIED,
    shouldShowSettings: status === RESULTS.BLOCKED,
  };

  // If blocked after request, show settings dialog
  if (result.shouldShowSettings) {
    showSettingsDialog(rationale?.title || 'Permission Required');
  }

  return result;
}

/**
 * Show rationale dialog before requesting permission
 * Returns true if user wants to proceed, false if cancelled
 */
function showRationaleDialog(rationale: PermissionRationale): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      rationale.title,
      rationale.message,
      [
        {
          text: rationale.buttonNegative || 'Not Now',
          onPress: () => resolve(false),
          style: 'cancel',
        },
        {
          text: rationale.buttonPositive || 'Continue',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Show settings navigation dialog for blocked permissions
 */
function showSettingsDialog(permissionName: string): void {
  Alert.alert(
    `${permissionName} Blocked`,
    `You have blocked ${permissionName}. Please enable it in Settings to use this feature.`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
    ],
  );
}

/**
 * Request multiple permissions sequentially
 * Useful when a feature requires multiple permissions
 *
 * @example
 * const results = await requestMultiplePermissions([
 *   {
 *     permission: PERMISSIONS.ANDROID.CAMERA,
 *     rationale: {
 *       title: 'Camera Access',
 *       message: 'We need camera access to take photos',
 *     },
 *   },
 *   {
 *     permission: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
 *     rationale: {
 *       title: 'Photo Access',
 *       message: 'We need access to select photos from your gallery',
 *     },
 *   },
 * ]);
 *
 * if (results.every(r => r.granted)) {
 *   // All permissions granted
 * }
 */
export async function requestMultiplePermissions(
  permissions: Array<{
    permission: Permission;
    rationale?: PermissionRationale;
  }>,
): Promise<PermissionResult[]> {
  const results: PermissionResult[] = [];

  for (const { permission, rationale } of permissions) {
    const result = await requestPermission(permission, rationale);
    results.push(result);

    // If user blocks a permission, stop requesting others
    if (result.shouldShowSettings) {
      break;
    }
  }

  return results;
}

/**
 * Get platform-specific permission
 * Handles Android version differences
 */
export function getPlatformPermission(
  permissionType: 'camera' | 'location' | 'photos' | 'notifications',
): Permission | null {
  if (Platform.OS !== 'android') {
    // iOS permissions handled separately
    return null;
  }

  switch (permissionType) {
    case 'camera':
      return PERMISSIONS.ANDROID.CAMERA;

    case 'location':
      return PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

    case 'photos':
      // Android 13+ uses READ_MEDIA_IMAGES
      // Android 12- uses READ_EXTERNAL_STORAGE
      return Platform.Version >= 33
        ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
        : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;

    case 'notifications':
      // Only required on Android 13+
      return Platform.Version >= 33 ? PERMISSIONS.ANDROID.POST_NOTIFICATIONS : null;

    default:
      return null;
  }
}
```

---

## Feature-Specific Helpers

### Camera Permission Helper

**Location:** Create `src/utils/permissions/camera.ts`

```typescript
import {PERMISSIONS} from 'react-native-permissions';
import {requestPermission, PermissionResult} from '../permissions';

/**
 * Request camera permission for taking photos
 *
 * @example
 * const result = await requestCameraPermission();
 * if (result.granted) {
 *   launchCamera();
 * }
 */
export async function requestCameraPermission(): Promise<PermissionResult> {
  return requestPermission(PERMISSIONS.ANDROID.CAMERA, {
    title: 'Camera Access',
    message:
      'We need camera access to let you take photos of food items. This helps recipients see what you're offering and makes donations more successful.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not Now',
  });
}

/**
 * Request camera permission for QR code scanning
 */
export async function requestQRScanPermission(): Promise<PermissionResult> {
  return requestPermission(PERMISSIONS.ANDROID.CAMERA, {
    title: 'Camera Access for QR Scanning',
    message:
      'We need camera access to scan QR codes for quick donation tracking and verification.',
    buttonPositive: 'Allow',
    buttonNegative: 'Skip',
  });
}
```

### Location Permission Helper

**Location:** Create `src/utils/permissions/location.ts`

```typescript
import { Platform } from 'react-native';
import { PERMISSIONS } from 'react-native-permissions';
import { requestPermission, requestMultiplePermissions, PermissionResult } from '../permissions';

/**
 * Request location permission for finding nearby food banks
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  return requestPermission(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, {
    title: 'Location Access',
    message:
      'We need your location to show nearby food donation centers and help you find the closest pickup points. Your location is never shared publicly.',
    buttonPositive: 'Allow',
    buttonNegative: 'Enter Manually',
  });
}

/**
 * Request background location permission for delivery tracking
 * IMPORTANT: Must request foreground location first (Android 10+)
 *
 * @example
 * const result = await requestBackgroundLocationPermission();
 * if (result.granted) {
 *   startDeliveryTracking();
 * } else {
 *   // Fallback to manual status updates
 * }
 */
export async function requestBackgroundLocationPermission(): Promise<PermissionResult> {
  if (Platform.OS !== 'android' || Platform.Version < 29) {
    // Background location not needed or not supported
    return {
      granted: true,
      status: 'granted',
      canAskAgain: false,
      shouldShowSettings: false,
    };
  }

  // Step 1: Request foreground location first
  const foregroundResult = await requestPermission(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, {
    title: 'Location Access',
    message:
      'To track your delivery in real-time, we need access to your location while using the app.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not Now',
  });

  if (!foregroundResult.granted) {
    return foregroundResult;
  }

  // Step 2: Request background location
  return requestPermission(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION, {
    title: 'Background Location Access',
    message:
      'To continue tracking your delivery even when the app is in the background, we need "Allow all the time" location access. This ensures accurate delivery updates.',
    buttonPositive: 'Allow All The Time',
    buttonNegative: 'While Using App',
  });
}
```

### Photo/Storage Permission Helper

**Location:** Create `src/utils/permissions/storage.ts`

```typescript
import { Platform } from 'react-native';
import { PERMISSIONS } from 'react-native-permissions';
import { requestPermission, PermissionResult, getPlatformPermission } from '../permissions';

/**
 * Request photo/storage permission for selecting images
 * Handles Android version differences automatically
 */
export async function requestPhotoPermission(): Promise<PermissionResult> {
  const permission = getPlatformPermission('photos');

  if (!permission) {
    // Permission not needed on this platform/version
    return {
      granted: true,
      status: 'granted',
      canAskAgain: false,
      shouldShowSettings: false,
    };
  }

  const message =
    Platform.Version >= 33
      ? 'We need access to your photos to let you select images for your food listings.'
      : 'We need storage access to let you select photos from your gallery.';

  return requestPermission(permission, {
    title: 'Photo Access',
    message,
    buttonPositive: 'Allow',
    buttonNegative: 'Skip Photos',
  });
}
```

### Notification Permission Helper

**Location:** Create `src/utils/permissions/notifications.ts`

```typescript
import { Platform } from 'react-native';
import { PERMISSIONS } from 'react-native-permissions';
import { requestPermission, PermissionResult, getPlatformPermission } from '../permissions';

/**
 * Request notification permission (Android 13+ only)
 *
 * @example
 * // Show during onboarding or when user enables notifications
 * const result = await requestNotificationPermission();
 * if (result.granted) {
 *   await registerForPushNotifications();
 * }
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  const permission = getPlatformPermission('notifications');

  if (!permission) {
    // Notifications always allowed on Android 12 and below
    return {
      granted: true,
      status: 'granted',
      canAskAgain: false,
      shouldShowSettings: false,
    };
  }

  return requestPermission(permission, {
    title: 'Enable Notifications',
    message:
      'Get notified about new donation requests, pickup confirmations, and food expiry reminders. You can customize notification types in settings.',
    buttonPositive: 'Enable',
    buttonNegative: 'Not Now',
  });
}

/**
 * Check if notifications are enabled
 * Works across all Android versions
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS handled separately
  }

  if (Platform.Version < 33) {
    return true; // Always allowed on Android 12-
  }

  const permission = PERMISSIONS.ANDROID.POST_NOTIFICATIONS;
  const result = await check(permission);
  return result === 'granted';
}
```

---

## Usage Examples

### Example 1: Take Photo for Food Listing

```typescript
import { launchCamera } from 'react-native-image-picker';
import { requestCameraPermission } from '@/utils/permissions/camera';

async function handleTakePhoto() {
  // Request permission with user-friendly rationale
  const result = await requestCameraPermission();

  if (!result.granted) {
    // Permission denied - offer alternative
    Alert.alert(
      'Camera Not Available',
      'You can still add a listing without photos, or select a photo from your gallery.',
      [
        { text: 'Skip Photos', onPress: () => createListingWithoutPhoto() },
        { text: 'Choose from Gallery', onPress: () => pickFromGallery() },
      ],
    );
    return;
  }

  // Permission granted - launch camera
  const response = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1024,
    maxHeight: 1024,
  });

  if (response.assets?.[0]) {
    setFoodPhoto(response.assets[0]);
  }
}
```

### Example 2: Find Nearby Food Banks

```typescript
import Geolocation from 'react-native-geolocation-service';
import { requestLocationPermission } from '@/utils/permissions/location';

async function findNearbyFoodBanks() {
  // Request location permission
  const result = await requestLocationPermission();

  if (!result.granted) {
    // Graceful degradation - manual address entry
    showManualAddressEntry();
    return;
  }

  // Permission granted - get current location
  Geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchNearbyFoodBanks(latitude, longitude);
    },
    (error) => {
      console.error('Location error:', error);
      showManualAddressEntry();
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
  );
}
```

### Example 3: Start Delivery Tracking

```typescript
import { requestBackgroundLocationPermission } from '@/utils/permissions/location';

async function startDeliveryTracking(deliveryId: string) {
  // Request background location permission
  const result = await requestBackgroundLocationPermission();

  if (!result.granted) {
    // Fallback to foreground-only tracking
    Alert.alert(
      'Background Tracking Disabled',
      'Delivery will be tracked only while the app is open. For continuous tracking, enable "Allow all the time" in settings.',
      [
        { text: 'OK', onPress: () => startForegroundTracking(deliveryId) },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return;
  }

  // Full background tracking enabled
  startBackgroundTracking(deliveryId);
}
```

### Example 4: Enable Push Notifications

```typescript
import messaging from '@react-native-firebase/messaging';
import { requestNotificationPermission } from '@/utils/permissions/notifications';

async function enablePushNotifications() {
  // Request notification permission (Android 13+ only)
  const result = await requestNotificationPermission();

  if (!result.granted) {
    // User declined - respect their choice
    console.log('User declined notifications');
    return;
  }

  // Permission granted - register for FCM
  const fcmToken = await messaging().getToken();
  await registerFCMToken(fcmToken);

  console.log('Push notifications enabled');
}
```

### Example 5: Permission-Gated Feature with Multiple Permissions

```typescript
import { requestMultiplePermissions } from '@/utils/permissions';
import { PERMISSIONS } from 'react-native-permissions';

async function startFoodPhotoUpload() {
  // Request both camera and storage permissions
  const results = await requestMultiplePermissions([
    {
      permission: PERMISSIONS.ANDROID.CAMERA,
      rationale: {
        title: 'Camera Access',
        message: 'Take a photo of your food item',
      },
    },
    {
      permission:
        Platform.Version >= 33
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
      rationale: {
        title: 'Photo Library Access',
        message: 'Access your photo library to select an image',
      },
    },
  ]);

  const allGranted = results.every((r) => r.granted);

  if (!allGranted) {
    // At least one permission denied
    const cameraGranted = results[0].granted;
    const storageGranted = results[1].granted;

    if (cameraGranted && !storageGranted) {
      // Can only take photos, not select
      showCameraOnly();
    } else if (!cameraGranted && storageGranted) {
      // Can only select photos
      showGalleryOnly();
    } else {
      // Neither granted
      showNoPhotoOption();
    }
    return;
  }

  // All permissions granted - show full options
  showPhotoOptions();
}
```

---

## React Hook for Permissions

**Location:** Create `src/hooks/usePermission.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Permission } from 'react-native-permissions';
import {
  checkPermission,
  requestPermission,
  PermissionResult,
  PermissionRationale,
} from '@/utils/permissions';

/**
 * React Hook for managing permission state
 *
 * @example
 * function CameraButton() {
 *   const {granted, request, isLoading} = usePermission(
 *     PERMISSIONS.ANDROID.CAMERA,
 *     {
 *       title: 'Camera Access',
 *       message: 'We need camera access to take photos',
 *     }
 *   );
 *
 *   return (
 *     <Button
 *       title="Take Photo"
 *       onPress={async () => {
 *         if (!granted) {
 *           const result = await request();
 *           if (!result.granted) return;
 *         }
 *         launchCamera();
 *       }}
 *       disabled={isLoading}
 *     />
 *   );
 * }
 */
export function usePermission(permission: Permission, rationale?: PermissionRationale) {
  const [result, setResult] = useState<PermissionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial permission status
  useEffect(() => {
    checkPermission(permission).then(setResult);
  }, [permission]);

  // Request permission
  const request = useCallback(async (): Promise<PermissionResult> => {
    setIsLoading(true);
    try {
      const newResult = await requestPermission(permission, rationale);
      setResult(newResult);
      return newResult;
    } finally {
      setIsLoading(false);
    }
  }, [permission, rationale]);

  // Refresh permission status
  const refresh = useCallback(async () => {
    const newResult = await checkPermission(permission);
    setResult(newResult);
  }, [permission]);

  return {
    granted: result?.granted ?? false,
    status: result?.status ?? 'unavailable',
    canAskAgain: result?.canAskAgain ?? true,
    shouldShowSettings: result?.shouldShowSettings ?? false,
    request,
    refresh,
    isLoading,
  };
}
```

**Hook Usage Example:**

```typescript
import {usePermission} from '@/hooks/usePermission';
import {PERMISSIONS} from 'react-native-permissions';

function LocationButton() {
  const {granted, request, isLoading} = usePermission(
    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    {
      title: 'Location Access',
      message: 'Find nearby food banks',
    },
  );

  const handlePress = async () => {
    if (!granted) {
      const result = await request();
      if (!result.granted) return;
    }

    // Permission granted
    findNearbyLocations();
  };

  return (
    <Button
      title={granted ? 'Find Nearby' : 'Enable Location'}
      onPress={handlePress}
      loading={isLoading}
    />
  );
}
```

---

## Testing Permissions

### Unit Tests (Jest)

```typescript
import { requestPermission } from '@/utils/permissions';
import { PERMISSIONS, RESULTS } from 'react-native-permissions';

// Mock the permission library
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
  },
  check: jest.fn(),
  request: jest.fn(),
}));

describe('requestPermission', () => {
  it('should return granted when permission already granted', async () => {
    const { check } = require('react-native-permissions');
    check.mockResolvedValue(RESULTS.GRANTED);

    const result = await requestPermission(PERMISSIONS.ANDROID.CAMERA);

    expect(result.granted).toBe(true);
    expect(result.status).toBe(RESULTS.GRANTED);
  });

  it('should request permission when denied', async () => {
    const { check, request } = require('react-native-permissions');
    check.mockResolvedValue(RESULTS.DENIED);
    request.mockResolvedValue(RESULTS.GRANTED);

    const result = await requestPermission(PERMISSIONS.ANDROID.CAMERA);

    expect(request).toHaveBeenCalledWith(PERMISSIONS.ANDROID.CAMERA);
    expect(result.granted).toBe(true);
  });
});
```

---

## Best Practices Summary

### ✓ DO

1. **Request Just-in-Time** - When user initiates action
2. **Show Clear Rationale** - Explain why you need permission
3. **Handle All States** - Granted, denied, blocked
4. **Provide Alternatives** - Graceful degradation
5. **Check Before Requesting** - Avoid unnecessary prompts
6. **Use TypeScript** - Type-safe permission handling

### ✗ DON'T

1. **Request on App Launch** - Terrible UX
2. **Request Without Explanation** - Confuses users
3. **Ignore Denial** - Leads to crashes
4. **Request Redundantly** - Check first
5. **Block Features Entirely** - Offer alternatives
6. **Use Deprecated APIs** - Use modern permission APIs

---

## Additional Resources

- **react-native-permissions:**
  https://github.com/zoontek/react-native-permissions
- **Android Best Practices:**
  https://developer.android.com/training/permissions/requesting
- **OWASP Mobile:** https://owasp.org/www-project-mobile-top-10/

---

**Created:** October 18, 2025 **Author:** Claude Code (Senior Software
Architect) **Status:** Production Ready
