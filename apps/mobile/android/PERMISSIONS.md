# Android Permissions - Enterprise Security Guide

**Last Updated:** October 18, 2025
**Documentation:** https://developer.android.com/training/permissions/requesting
**OWASP Reference:** https://owasp.org/www-project-mobile-top-10/ (M1: Improper Platform Usage)
**Package Name:** `com.foodwasteapp`

---

## Overview

This document provides a comprehensive guide to all Android permissions used by the Food Waste Mobile App, including when they're requested, why they're needed, and how to handle them correctly.

**Security Principles:**
1. **Principle of Least Privilege** - Request only necessary permissions
2. **Runtime Requests** - All dangerous permissions requested at runtime (Android 6.0+)
3. **Just-in-Time** - Request permissions when needed, not upfront
4. **User Education** - Explain why permission is needed before requesting
5. **Graceful Degradation** - App functions without optional permissions

---

## Permission Categories

### Normal Permissions (Auto-Granted)

Granted automatically at install time, no runtime request needed.

| Permission | Declared In | Purpose | User Impact |
|-----------|-------------|---------|-------------|
| `INTERNET` | Main manifest | Network API calls, downloads | None (expected for apps) |
| `USE_BIOMETRIC` | Main manifest | Fingerprint/Face authentication | None (doesn't access biometric data) |
| `VIBRATE` | Native module (haptic) | Haptic feedback | None (common UX pattern) |
| `ACCESS_NETWORK_STATE` | Native module (netinfo) | Check online/offline status | None (doesn't access data) |
| `SYSTEM_ALERT_WINDOW` | Debug manifest only | React Native dev overlays | Debug only (not in production) |

**Security Note:** Normal permissions cannot be revoked by user and pose minimal privacy risk.

---

### Dangerous Permissions (Runtime Request Required)

Must be requested at runtime with user approval. User can revoke at any time.

#### 📍 Location Permissions

**Native Module:** `react-native-geolocation-service`, `react-native-maps`

| Permission | Min SDK | Purpose | Sensitivity |
|-----------|---------|---------|-------------|
| `ACCESS_FINE_LOCATION` | 1 | Precise GPS location (food pickup, donation mapping) | HIGH |
| `ACCESS_COARSE_LOCATION` | 1 | Approximate location (nearby food banks) | MEDIUM |
| `ACCESS_BACKGROUND_LOCATION` | 29 (Android 10+) | Track deliveries in background | CRITICAL |

**When Requested:**
- Fine Location: When user searches for nearby food banks
- Coarse Location: Alternative to fine location (less accurate)
- Background Location: When user starts a delivery (only if needed)

**User Benefit:**
- Find nearest food donation locations
- Get directions to pickup points
- Track donation deliveries in real-time

**Privacy Controls:**
```typescript
// Always check permission status first
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

async function requestLocationPermission() {
  const status = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

  if (status === RESULTS.GRANTED) {
    return true;
  }

  // Show rationale first (best practice)
  await showLocationRationaleDialog();

  const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
  return result === RESULTS.GRANTED;
}
```

**Background Location (Special Handling):**
```typescript
// Android 10+ requires TWO-STEP permission request
// Step 1: Request foreground location
const foregroundStatus = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

if (foregroundStatus === RESULTS.GRANTED) {
  // Step 2: ONLY then request background location
  // Must show clear rationale why background access is needed
  await showBackgroundLocationRationale();
  const backgroundStatus = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
}
```

**Play Store Requirements:**
- Must disclose location data collection in Data Safety section
- Must provide in-app privacy policy
- Background location requires additional justification

---

#### 📷 Camera Permission

**Native Module:** `react-native-image-picker`, `react-native-qrcode-scanner`

| Permission | Min SDK | Purpose | Sensitivity |
|-----------|---------|---------|-------------|
| `CAMERA` | 1 | Take photos of food items, scan QR codes | MEDIUM |

**When Requested:**
- User taps "Take Photo" in food listing
- User taps "Scan QR Code" for donation tracking

**User Benefit:**
- Add photos to food listings
- Quick donation tracking via QR codes

**Privacy Controls:**
```typescript
async function requestCameraPermission() {
  const status = await check(PERMISSIONS.ANDROID.CAMERA);

  if (status === RESULTS.GRANTED) return true;
  if (status === RESULTS.BLOCKED) {
    // User permanently denied, guide to settings
    Alert.alert(
      'Camera Access Required',
      'Please enable camera access in Settings to take photos',
      [{text: 'Open Settings', onPress: () => Linking.openSettings()}]
    );
    return false;
  }

  const result = await request(PERMISSIONS.ANDROID.CAMERA);
  return result === RESULTS.GRANTED;
}
```

---

#### 🖼️ Photo/Media Permissions

**Native Module:** `react-native-image-picker`

**Android 13+ (API 33):**
| Permission | Purpose |
|-----------|---------|
| `READ_MEDIA_IMAGES` | Select photos from gallery (granular access) |
| `READ_MEDIA_VIDEO` | Select videos from gallery |

**Android 12 and below (API 32-):**
| Permission | Purpose |
|-----------|---------|
| `READ_EXTERNAL_STORAGE` | Read photos/videos from storage |
| `WRITE_EXTERNAL_STORAGE` | Save photos to storage |

**Version-Specific Handling:**
```typescript
import {Platform} from 'react-native';

async function requestPhotoPermission() {
  const permission = Platform.Version >= 33
    ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
    : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;

  const status = await check(permission);
  if (status === RESULTS.GRANTED) return true;

  const result = await request(permission);
  return result === RESULTS.GRANTED;
}
```

**User Benefit:**
- Upload existing photos of food items
- Share donation receipts

---

#### 🔔 Notification Permission

**Native Module:** `@react-native-firebase/messaging`

| Permission | Min SDK | Purpose | Sensitivity |
|-----------|---------|---------|-------------|
| `POST_NOTIFICATIONS` | 33 (Android 13+) | Show push notifications | LOW |

**When Requested:**
- First app launch (optional)
- When user enables notification preferences
- Just-in-time before sending first notification

**User Benefit:**
- Donation request alerts
- Food expiry reminders
- Pickup confirmation notifications

**Best Practice (Gradual Permission):**
```typescript
// DON'T request on first launch
// DO request when user explicitly wants notifications

async function enableNotifications() {
  if (Platform.Version < 33) {
    // Android 12 and below: notifications always allowed
    return true;
  }

  // Android 13+: explicit permission required
  const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);

  if (status === RESULTS.GRANTED) return true;

  // Show value proposition first
  await showNotificationBenefitsDialog();

  const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
  return result === RESULTS.GRANTED;
}
```

---

## Permission Request Flow (Best Practices)

### 1. Check Permission Status

```typescript
import {check, PERMISSIONS, RESULTS} from 'react-native-permissions';

const status = await check(PERMISSIONS.ANDROID.CAMERA);

switch (status) {
  case RESULTS.UNAVAILABLE:
    // Permission not available on this device
    console.log('Camera not available');
    break;
  case RESULTS.DENIED:
    // Permission not requested yet or denied (can request)
    const result = await request(PERMISSIONS.ANDROID.CAMERA);
    break;
  case RESULTS.LIMITED:
    // iOS only
    break;
  case RESULTS.GRANTED:
    // Permission granted
    proceedWithCamera();
    break;
  case RESULTS.BLOCKED:
    // User permanently denied (must go to settings)
    showSettingsPrompt();
    break;
}
```

### 2. Show Rationale (Before Request)

```typescript
function showCameraRationale() {
  return new Promise(resolve => {
    Alert.alert(
      'Camera Access',
      'We need camera access to let you take photos of food items for your listings. This helps donors see what you're offering.',
      [
        {text: 'Not Now', onPress: () => resolve(false), style: 'cancel'},
        {text: 'OK', onPress: () => resolve(true)},
      ]
    );
  });
}

async function requestCameraWithRationale() {
  const shouldRequest = await showCameraRationale();
  if (!shouldRequest) return false;

  const result = await request(PERMISSIONS.ANDROID.CAMERA);
  return result === RESULTS.GRANTED;
}
```

### 3. Handle Denial Gracefully

```typescript
async function takePictureWithPermission() {
  const hasPermission = await requestCameraPermission();

  if (!hasPermission) {
    // Graceful degradation: offer alternative
    Alert.alert(
      'Camera Not Available',
      'You can still select a photo from your gallery',
      [{text: 'Choose from Gallery', onPress: () => pickFromGallery()}]
    );
    return;
  }

  // Permission granted, proceed
  launchCamera();
}
```

### 4. Handle Permanent Denial (Blocked)

```typescript
import {Linking} from 'react-native';

function showSettingsPrompt() {
  Alert.alert(
    'Permission Required',
    'Camera access has been blocked. Please enable it in Settings to take photos.',
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Open Settings', onPress: () => Linking.openSettings()},
    ]
  );
}
```

---

## Feature-to-Permission Mapping

### Primary Features

| Feature | Required Permissions | Optional Permissions | Fallback Behavior |
|---------|---------------------|---------------------|-------------------|
| Food Listing Creation | `INTERNET` | `CAMERA`, `READ_MEDIA_IMAGES` | No photos (text only) |
| Find Nearby Food Banks | `INTERNET`, `ACCESS_FINE_LOCATION` | - | Manual address entry |
| QR Code Scanning | `CAMERA` | - | Manual code entry |
| Delivery Tracking | `ACCESS_FINE_LOCATION` | `ACCESS_BACKGROUND_LOCATION` | Manual status updates |
| Push Notifications | `INTERNET` | `POST_NOTIFICATIONS` (Android 13+) | In-app notifications only |
| Photo Upload | `INTERNET` | `READ_MEDIA_IMAGES` or `READ_EXTERNAL_STORAGE` | Skip photos |
| Biometric Login | `USE_BIOMETRIC` | - | PIN/password login |

### Permission Combinations

**Food Donation Flow:**
```
1. List Food Item
   └─ Camera (optional) → Take photo
   └─ Storage (optional) → Select photo
   └─ Location (optional) → Set pickup location
   └─ Internet (required) → Upload listing

2. Find Recipients
   └─ Location (required) → Find nearby users
   └─ Internet (required) → Fetch recipients

3. Delivery Tracking
   └─ Foreground Location (required) → Track delivery
   └─ Background Location (optional) → Continue tracking when app backgrounded
```

---

## Permission Groups (Android System)

Android groups related permissions together. Granting one permission in a group grants all in that group.

| Permission Group | Included Permissions | Our Usage |
|-----------------|---------------------|-----------|
| **Location** | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`* | Find food banks, delivery tracking |
| **Camera** | `CAMERA` | Photos, QR codes |
| **Storage** | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Photo selection (Android 12-) |

*Note: Android 10+ treats background location separately*

**Implication:** Requesting `ACCESS_FINE_LOCATION` also grants `ACCESS_COARSE_LOCATION`.

---

## Data Safety Declaration (Google Play)

**Required for Play Store submission.**

### Data Types Collected

Based on permissions used:

| Permission | Data Type | Collection Purpose | Sharing |
|-----------|-----------|-------------------|---------|
| Location | Precise/Approximate | App functionality (find food banks) | No |
| Camera | Photos | App functionality (food photos) | No |
| Storage | Photos/Media | App functionality (upload photos) | No |
| Notifications | Device ID, notification tokens | App functionality (alerts) | Firebase only |

### Required Privacy Policy

Must disclose:
1. What data is collected
2. Why it's collected
3. How it's used
4. How it's stored/secured
5. How users can delete data

**Privacy Policy URL:** https://foodwasteapp.com/privacy

---

## Security Best Practices

### ✓ DO

1. **Request Just-in-Time**
   ```typescript
   // Good: Request when needed
   async function takePhoto() {
     const hasPermission = await requestCameraPermission();
     if (hasPermission) launchCamera();
   }
   ```

2. **Explain Before Requesting**
   ```typescript
   // Show clear rationale
   Alert.alert(
     'Location Access',
     'We need your location to show nearby food donation centers',
     [{text: 'OK', onPress: () => request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)}]
   );
   ```

3. **Check Permission Status First**
   ```typescript
   const status = await check(PERMISSIONS.ANDROID.CAMERA);
   if (status === RESULTS.GRANTED) {
     // Already granted, proceed
   }
   ```

4. **Handle All Result Cases**
   ```typescript
   switch (result) {
     case RESULTS.GRANTED: /* proceed */ break;
     case RESULTS.DENIED: /* retry or explain */ break;
     case RESULTS.BLOCKED: /* guide to settings */ break;
   }
   ```

### ✗ DON'T

1. **Request All Permissions Upfront**
   ```typescript
   // Bad: Don't request everything on app launch
   async function requestAllPermissions() {
     await request(PERMISSIONS.ANDROID.CAMERA);
     await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
     await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
   }
   ```

2. **Request Without Explanation**
   ```typescript
   // Bad: User doesn't know why
   await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
   ```

3. **Ignore Denial**
   ```typescript
   // Bad: No fallback
   const result = await request(PERMISSIONS.ANDROID.CAMERA);
   launchCamera(); // Will crash if denied!
   ```

---

## Testing Permissions

### Reset Permissions on Device

```bash
# Reset all permissions for app
adb shell pm reset-permissions com.foodwasteapp

# Reset specific permission
adb shell pm revoke com.foodwasteapp android.permission.CAMERA

# Grant permission (for automated testing)
adb shell pm grant com.foodwasteapp android.permission.ACCESS_FINE_LOCATION
```

### Test Permission States

```bash
# Check current permissions
adb shell dumpsys package com.foodwasteapp | grep permission

# Output shows:
# requested permissions:
#   android.permission.INTERNET
#   android.permission.CAMERA
# install permissions:
#   android.permission.INTERNET: granted=true
# runtime permissions:
#   android.permission.CAMERA: granted=false
```

---

## OWASP Mobile Top 10 Compliance

### M1: Improper Platform Usage

**Risk:** Requesting unnecessary permissions or not following permission best practices

**Mitigation:**
- ✓ Only request necessary permissions
- ✓ Request at appropriate time (just-in-time)
- ✓ Provide clear rationale
- ✓ Handle denial gracefully
- ✓ Respect user choices

### M2: Insecure Data Storage

**Risk:** Storing sensitive data accessible via permissions

**Mitigation:**
- ✓ Don't store location history unnecessarily
- ✓ Photos stored in app-private directory
- ✓ No caching of sensitive permission-related data

### M4: Insecure Authentication

**Risk:** Weak biometric implementation

**Mitigation:**
- ✓ Use `USE_BIOMETRIC` (modern API)
- ✓ Fallback to PIN/password
- ✓ Don't store biometric data
- ✓ Use Android Keystore for secrets

---

## Troubleshooting

### Permission Request Not Showing

**Cause:** Permission already denied or blocked

**Solution:**
```typescript
const status = await check(PERMISSIONS.ANDROID.CAMERA);
if (status === RESULTS.BLOCKED) {
  // Guide user to settings
  Linking.openSettings();
}
```

### Permission Granted but Feature Not Working

**Cause:** Permission might be limited or feature-specific issue

**Solution:**
```typescript
// Re-check permission
const status = await check(PERMISSIONS.ANDROID.CAMERA);
console.log('Permission status:', status);

// Check for device capability
const hasCamera = await Camera.isAvailable();
```

### Background Location Not Working (Android 10+)

**Cause:** Must request foreground location first

**Solution:**
```typescript
// Two-step process
const foreground = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
if (foreground === RESULTS.GRANTED) {
  const background = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
}
```

---

## Additional Resources

- **Official Android Permissions Guide:** https://developer.android.com/training/permissions/requesting
- **OWASP Mobile Top 10:** https://owasp.org/www-project-mobile-top-10/
- **react-native-permissions Documentation:** https://github.com/zoontek/react-native-permissions
- **Google Play Data Safety:** https://support.google.com/googleplay/android-developer/answer/10787469
- **Android 13+ Notification Permission:** https://developer.android.com/training/permissions/requesting#notification-permission
- **Background Location Best Practices:** https://developer.android.com/training/location/permissions#background

---

**Created:** October 18, 2025
**Author:** Claude Code (Senior Software Architect)
**Status:** Enterprise Production Ready
**Compliance:** OWASP M1, Google Play Data Safety, GDPR
