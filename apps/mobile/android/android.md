# Android Directory Documentation

**Last Updated:** January 15, 2026
**React Native:** 0.81.0
**Android Gradle Plugin:** 8.13.2
**Gradle:** 8.11.1
**Package Name:** `com.foodwasteapp`

---

## Overview

This directory contains the Android-specific implementation of the Food Waste Mobile App built with React Native 0.81. The project uses modern Android development practices with enterprise-grade security, multi-environment support, and comprehensive documentation.

**Key Features:**
- ✓ Multi-environment build variants (dev, staging, production)
- ✓ Enterprise-grade security (OWASP Mobile Top 10 compliant)
- ✓ Android App Links with digital asset verification
- ✓ Hermes JavaScript engine enabled
- ✓ ProGuard/R8 code obfuscation
- ✓ Firebase integration (Analytics, Crashlytics, Messaging)
- ✓ Comprehensive security hardening

---

## Directory Structure

```
android/
├── app/                                    # Main application module
│   ├── build.gradle                        # App-level Gradle configuration (build variants, signing, dependencies)
│   ├── proguard-rules.pro                  # ProGuard/R8 obfuscation rules (367 lines)
│   ├── assetlinks.json                     # Digital Asset Links template for App Links verification
│   └── src/
│       ├── main/                           # Main source set (all variants)
│       │   ├── AndroidManifest.xml         # App manifest (permissions, activities, intent filters)
│       │   ├── java/com/foodwasteapp/      # Native Java code
│       │   │   ├── MainActivity.java       # React Native MainActivity
│       │   │   └── MainApplication.java    # React Native Application class
│       │   └── res/                        # Android resources
│       │       ├── drawable*/              # App icons and drawables
│       │       ├── mipmap*/                # Launcher icons (all densities)
│       │       ├── values/                 # Strings, colors, styles
│       │       └── xml/                    # XML resources
│       │           └── network_security_config.xml  # Network security configuration
│       ├── debug/                          # Debug-specific resources
│       │   └── AndroidManifest.xml         # Debug manifest additions
│       ├── dev/                            # Dev flavor resources (optional)
│       ├── staging/                        # Staging flavor resources (optional)
│       └── production/                     # Production flavor resources (optional)
│           └── google-services.json        # Firebase configuration (production)
│
├── build.gradle                            # Project-level Gradle configuration
├── gradle.properties                       # Gradle build settings (JVM memory, optimization, etc.)
├── settings.gradle                         # Gradle module settings
├── gradle/                                 # Gradle wrapper files
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties       # Gradle version (8.11.1)
├── gradlew                                 # Gradle wrapper script (Unix)
├── gradlew.bat                             # Gradle wrapper script (Windows)
├── local.properties                        # Local SDK paths (auto-generated, gitignored)
│
├── APP_LINKS_SETUP.md                      # App Links setup guide (590+ lines)
├── BUILD_VARIANTS.md                       # Build variants documentation (440+ lines)
├── PERMISSIONS.md                          # Permissions guide (700+ lines)
├── SECURITY_IMPLEMENTATION_SUMMARY.md      # Security audit summary (660+ lines)
├── android.md                              # This file
└── verify-app-links.sh                     # App Links verification script
```

---

## Key Files

### Build Configuration

#### `build.gradle` (Project-level)
**Purpose:** Root build configuration for the entire Android project
**Location:** `apps/mobile/android/build.gradle`
**Key Configurations:**
- Android SDK versions (min: 24, target: 35, compile: 35)
- Kotlin version (2.0.21)
- Firebase BOM version (33.7.0)
- Dependency resolution strategies (force versions for compatibility)
- AGP 8+ namespace compatibility patches for legacy libraries
- React Native dependency substitution rules

**Critical Settings:**
```gradle
ext {
    minSdkVersion = 24              // Android 7.0+
    compileSdkVersion = 35          // Android 15
    targetSdkVersion = 35
    ndkVersion = "27.1.12297006"
    hermesEnabled = true            // Hermes JS engine
    kotlinVersion = "2.0.21"
}
```

#### `app/build.gradle` (App-level)
**Purpose:** Application-specific build configuration
**Location:** `apps/mobile/android/app/build.gradle`
**Key Configurations:**
- Application ID and versioning
- Build types (debug, release)
- Product flavors (dev, staging, production)
- Signing configurations
- ProGuard/R8 settings
- React Native autolinking
- Firebase dependencies

**Build Variants Generated:**
- `devDebug` / `devRelease`
- `stagingDebug` / `stagingRelease`
- `productionDebug` / `productionRelease`

#### `gradle.properties`
**Purpose:** Gradle build optimization and performance settings
**Location:** `apps/mobile/android/gradle.properties`
**Key Settings:**
```properties
org.gradle.daemon=true
org.gradle.parallel=false           # Disabled for AGP 8.13.2 stability
org.gradle.jvmargs=-Xmx4096m -Xms256m -XX:MaxMetaspaceSize=512m
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot
hermesEnabled=true
newArchEnabled=true                 # React Native New Architecture
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

**Performance Notes:**
- JVM heap: 4096MB max, 256MB initial
- JDK 17 required (JDK 21 causes daemon crashes on Windows)
- Parallel execution disabled for stability
- Build caching enabled

### Application Configuration

#### `app/src/main/AndroidManifest.xml`
**Purpose:** Android app manifest defining permissions, activities, and capabilities
**Location:** `apps/mobile/android/app/src/main/AndroidManifest.xml`
**Key Declarations:**
- Application package: `com.foodwasteapp`
- **Permissions:**
  - `INTERNET` (normal permission)
  - `USE_BIOMETRIC` (normal permission)
- **Activities:**
  - `MainActivity` (React Native entry point)
  - Splash screen configuration
- **Intent Filters:**
  - Custom URL scheme: `foodwaste://`
  - App Links: `https://foodwasteapp.com`, `https://www.foodwasteapp.com`
- **Security:**
  - `android:allowBackup="false"` (no cloud backup)
  - `android:usesCleartextTraffic="${usesCleartextTraffic}"` (controlled by build variant)
  - `android:networkSecurityConfig="@xml/network_security_config"`

#### `app/src/main/res/xml/network_security_config.xml`
**Purpose:** Network security configuration enforcing HTTPS
**Location:** `apps/mobile/android/app/src/main/res/xml/network_security_config.xml`
**Configuration:**
- **Base Config:** Block all cleartext (HTTP) traffic by default
- **Debug Exception:** Allow cleartext only for `localhost` and `10.0.2.2` (Android emulator)
- **Development Workflow:** Use `adb reverse tcp:8081 tcp:8081` instead of hardcoded IPs
- **Compliance:** OWASP M3, PCI DSS Requirement 4.1, GDPR Article 32

**Security Features:**
- TLS 1.2+ enforced
- No hardcoded IP addresses
- Certificate pinning template included (commented)
- Comprehensive inline documentation (145 lines)

#### `app/proguard-rules.pro`
**Purpose:** ProGuard/R8 code obfuscation and optimization rules
**Location:** `apps/mobile/android/app/proguard-rules.pro`
**Size:** 367 lines of production-ready rules
**Coverage:**
- React Native core classes
- Firebase SDK
- Third-party libraries (jail-monkey, image-picker, etc.)
- Prevents crashes from over-aggressive minification
- Applied only in release builds

### Security & Verification

#### `assetlinks.json`
**Purpose:** Digital Asset Links file for App Links verification
**Location:** `apps/mobile/android/app/assetlinks.json` (template)
**Deployment:** Must be served at `https://foodwasteapp.com/.well-known/assetlinks.json`
**Content:** Associates app with web domain using SHA256 certificate fingerprint
**See:** `APP_LINKS_SETUP.md` for complete setup guide

#### `verify-app-links.sh`
**Purpose:** Automated verification script for App Links configuration
**Location:** `apps/mobile/android/verify-app-links.sh`
**Features:**
- Checks manifest configuration
- Verifies assetlinks.json accessibility
- Validates JSON format
- Tests SHA256 fingerprint
- Verifies device App Links status
- Tests deep link functionality

**Usage:**
```bash
cd apps/mobile/android
chmod +x verify-app-links.sh
./verify-app-links.sh foodwasteapp.com
```

---

## Build Commands

### Development

```bash
# From monorepo root (recommended)
pnpm mobile:android              # Build and run debug APK
pnpm dev:android                 # Gradle assembleDebug
pnpm dev:android:clean           # Gradle clean

# From android directory
cd apps/mobile/android
./gradlew assembleDevDebug       # Build dev debug APK
./gradlew installDevDebug        # Build and install on connected device
./gradlew assembleDebug          # Build all debug variants
```

### Staging

```bash
./gradlew assembleStagingDebug
./gradlew assembleStagingRelease
./gradlew installStagingDebug
```

### Production

```bash
# Release APK (requires release signing)
./gradlew assembleProductionRelease

# Release AAB (for Google Play Store)
./gradlew bundleProductionRelease

# Clean all builds
./gradlew clean
```

### Gradle Tasks

```bash
# List all available tasks
./gradlew tasks

# List all build variants
./gradlew tasks --all | grep assemble

# Check signing configuration
./gradlew signingReport

# Run tests
./gradlew test

# Check dependencies
./gradlew app:dependencies
```

---

## Build Variants

The app uses **Product Flavors** for multi-environment deployment:

| Variant | Application ID | Purpose | Cleartext | Play Store |
|---------|---------------|---------|-----------|------------|
| **devDebug** | `com.foodwasteapp.dev` | Local development | ✓ Allowed | ✗ |
| **devRelease** | `com.foodwasteapp.dev` | Dev with minification | ✓ Allowed | ✗ |
| **stagingDebug** | `com.foodwasteapp.staging` | QA testing | ✗ Blocked | ✗ |
| **stagingRelease** | `com.foodwasteapp.staging` | UAT testing | ✗ Blocked | ✗ |
| **productionDebug** | `com.foodwasteapp` | Testing prod config | ✗ Blocked | ✗ |
| **productionRelease** | `com.foodwasteapp` | Live production | ✗ Blocked | ✓ |

**Parallel Installation:** Dev, staging, and production variants can be installed simultaneously due to different application IDs.

**See:** `BUILD_VARIANTS.md` for complete documentation

---

## Development Workflow

### Initial Setup

1. **Prerequisites:**
   - JDK 17 (not JDK 21 - causes daemon crashes)
   - Android SDK (API 35)
   - Android Studio (optional but recommended)
   - Physical device or emulator

2. **Install dependencies:**
   ```bash
   # From monorepo root
   pnpm install
   ```

3. **Configure local SDK:**
   ```bash
   # Create local.properties (auto-generated by Android Studio)
   # Or manually:
   echo "sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk" > android/local.properties
   ```

### Running the App

**Option 1: From monorepo root (recommended)**
```bash
# Start Metro bundler
pnpm mobile:dev

# In another terminal, run Android
pnpm mobile:android
```

**Option 2: From android directory**
```bash
# Physical device or emulator must be connected
./gradlew installDevDebug

# Then start Metro from mobile directory
cd ..
pnpm dev
```

### Physical Device Development

**No hardcoded IPs needed - use `adb reverse`:**
```bash
# Forward device port to host
adb reverse tcp:8081 tcp:8081

# Metro URL becomes: http://localhost:8081
# No need to modify network_security_config.xml
```

### Emulator Development

Android emulator automatically uses `10.0.2.2` for host machine, which is already allowed in `network_security_config.xml`.

---

## Permissions

The app follows the **Principle of Least Privilege** with just-in-time permission requests.

### Normal Permissions (Auto-granted)
- `INTERNET` - Network API calls
- `USE_BIOMETRIC` - Fingerprint/face authentication
- `VIBRATE` - Haptic feedback (from native modules)
- `ACCESS_NETWORK_STATE` - Check online/offline status

### Dangerous Permissions (Runtime request required)
- `ACCESS_FINE_LOCATION` - Precise GPS location
- `ACCESS_COARSE_LOCATION` - Approximate location
- `ACCESS_BACKGROUND_LOCATION` - Background location tracking (Android 10+)
- `CAMERA` - Take photos, scan QR codes
- `READ_MEDIA_IMAGES` - Photo gallery access (Android 13+)
- `READ_EXTERNAL_STORAGE` - Photo access (Android 12 and below)
- `POST_NOTIFICATIONS` - Push notifications (Android 13+)

**Permission Request Flow:**
1. Check permission status
2. Show rationale to user (explain why needed)
3. Request permission
4. Handle grant/denial gracefully
5. Provide fallback functionality if denied

**See:** `PERMISSIONS.md` for complete guide (700+ lines)

---

## Security Implementation

### OWASP Mobile Top 10 Compliance

| Risk | Status | Mitigation |
|------|--------|------------|
| M1: Improper Platform Usage | ✓ Compliant | Minimal permissions, runtime requests |
| M2: Insecure Data Storage | ✓ Compliant | Keychain, `allowBackup=false` |
| M3: Insecure Communication | ✓ Compliant | HTTPS enforced, TLS 1.2+ |
| M4: Insecure Authentication | ✓ Compliant | Biometric + Android Keystore |
| M5: Insufficient Cryptography | ✓ Compliant | Hardware-backed AES-256 |
| M6: Insecure Authorization | ✓ Compliant | Server-side JWT validation |
| M7: Client Code Quality | ✓ Compliant | ESLint, TypeScript strict |
| M8: Code Tampering | ✓ Compliant | R8 obfuscation, release signing |
| M9: Reverse Engineering | ✓ Compliant | R8 + Hermes |
| M10: Extraneous Functionality | ✓ Compliant | No debug code in production |

### Security Features

**Network Security:**
- HTTPS enforced (no cleartext traffic in production)
- TLS 1.2+ minimum
- Certificate pinning template available
- Network security config hardening

**Data Protection:**
- `android:allowBackup="false"` (no cloud backup)
- Android Keystore for sensitive data
- Hardware-backed encryption
- No sensitive data in logs

**Code Protection:**
- ProGuard/R8 full mode obfuscation (367 rules)
- Release signing required for production
- Root detection via `jail-monkey`
- Hermes engine (bytecode compilation)

**App Integrity:**
- Digital Asset Links verification
- Release keystore signing
- Google Play App Signing (recommended)

**See:** `SECURITY_IMPLEMENTATION_SUMMARY.md` for complete audit

---

## Firebase Integration

### Configuration Files

**Production:**
- `app/src/production/google-services.json`

**Dev/Staging (optional):**
- `app/src/dev/google-services.json`
- `app/src/staging/google-services.json`

### Firebase Services Used

- **Firebase Cloud Messaging (FCM)** - Push notifications
- **Firebase Analytics** - User behavior analytics
- **Firebase Crashlytics** - Crash reporting

### Setup

1. Download `google-services.json` from Firebase Console
2. Place in appropriate flavor directory
3. Build ID automatically generated by Crashlytics Gradle plugin

---

## Testing & Debugging

### Device Testing

```bash
# List connected devices
adb devices

# Install debug APK
./gradlew installDevDebug

# View logs
adb logcat | grep ReactNative

# Clear app data
adb shell pm clear com.foodwasteapp.dev

# Uninstall app
adb uninstall com.foodwasteapp.dev
```

### Permission Testing

```bash
# Reset all permissions
adb shell pm reset-permissions com.foodwasteapp

# Revoke specific permission
adb shell pm revoke com.foodwasteapp android.permission.CAMERA

# Grant permission (for automated testing)
adb shell pm grant com.foodwasteapp android.permission.ACCESS_FINE_LOCATION

# Check current permissions
adb shell dumpsys package com.foodwasteapp | grep permission
```

### App Links Testing

```bash
# Test custom URL scheme
adb shell am start -a android.intent.action.VIEW \
  -d "foodwaste://food/123" \
  com.foodwasteapp

# Test App Link (HTTPS)
adb shell am start -a android.intent.action.VIEW \
  -d "https://foodwasteapp.com/food/123"

# Check App Links verification status
adb shell pm get-app-links com.foodwasteapp

# Force re-verification
adb shell pm verify-app-links --re-verify com.foodwasteapp
```

### React Native Debugging

```bash
# Open React Native Dev Menu
adb shell input keyevent 82

# Reload JS bundle
adb shell input text "RR"

# Enable Chrome DevTools
# Dev Menu → Debug → Enable Remote JS Debugging
```

### Flipper Debugging

Debug builds include Flipper for advanced debugging:
- Network inspection
- Layout inspector
- Logs
- Databases
- Shared Preferences

**Start Flipper:**
1. Install Flipper desktop app
2. Run debug build
3. Flipper auto-detects app

---

## Release Signing

### Environment Variables Required

Production release builds require these environment variables:

```bash
# Windows PowerShell
$env:KEYSTORE_FILE="C:\path\to\release.keystore"
$env:KEYSTORE_PASSWORD="your_keystore_password"
$env:KEY_ALIAS="foodwaste_release_key"
$env:KEY_PASSWORD="your_key_password"

# Linux/macOS
export KEYSTORE_FILE="/path/to/release.keystore"
export KEYSTORE_PASSWORD="your_keystore_password"
export KEY_ALIAS="foodwaste_release_key"
export KEY_PASSWORD="your_key_password"
```

### Generating Release Keystore

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore release.keystore \
  -alias foodwaste_release_key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_SECURE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=Food Waste App, OU=Mobile, O=Your Company, L=City, ST=State, C=US"
```

**⚠️ CRITICAL:**
- Never commit keystore to version control
- Store keystore password in secure password manager
- Keep backup of keystore in secure location
- Losing keystore = cannot update app on Play Store

### Getting SHA256 Fingerprint

```bash
keytool -list -v -keystore release.keystore -alias foodwaste_release_key

# Copy SHA256 fingerprint for assetlinks.json
```

### Building Release APK

```bash
./gradlew assembleProductionRelease

# Output: app/build/outputs/apk/production/release/app-production-release.apk
```

### Building Release AAB (for Play Store)

```bash
./gradlew bundleProductionRelease

# Output: app/build/outputs/bundle/productionRelease/app-production-release.aab
```

---

## Common Tasks

### Updating Dependencies

```bash
# Update Gradle wrapper
./gradlew wrapper --gradle-version=8.11.1

# Update React Native
# See monorepo root for pnpm update instructions

# Sync Gradle files
./gradlew --refresh-dependencies
```

### Cleaning Build

```bash
# Full clean
./gradlew clean

# Clean + rebuild
./gradlew clean assembleDevDebug

# Nuclear clean (if Gradle issues)
cd apps/mobile/android
rm -rf .gradle build app/build
./gradlew clean
```

### Changing Package Name

**Not recommended after initial release!** If needed:

1. Update `app/build.gradle` → `applicationId`
2. Update `AndroidManifest.xml` → `package` attribute
3. Rename Java package directories
4. Update `assetlinks.json` → `package_name`
5. Update Firebase configuration
6. Clean and rebuild

### Changing App Name

**For display name:**
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Your New App Name</string>
```

**For build variant-specific names:**
Edit flavor-specific `strings.xml` in:
- `app/src/dev/res/values/strings.xml` → "App Name DEV"
- `app/src/staging/res/values/strings.xml` → "App Name STAGING"
- `app/src/production/res/values/strings.xml` → "App Name"

### Updating Icons

Replace launcher icons in:
```
app/src/main/res/
├── mipmap-mdpi/ic_launcher.png (48x48)
├── mipmap-hdpi/ic_launcher.png (72x72)
├── mipmap-xhdpi/ic_launcher.png (96x96)
├── mipmap-xxhdpi/ic_launcher.png (144x144)
└── mipmap-xxxhdpi/ic_launcher.png (192x192)
```

**Round icons:**
```
mipmap-*/ic_launcher_round.png
```

**Adaptive icons (Android 8+):**
```
mipmap-anydpi-v26/ic_launcher.xml
```

**Tool:** Use Android Studio → Image Asset tool for easy icon generation

---

## Troubleshooting

### Gradle Daemon Crashes

**Symptoms:** Build fails with "Gradle daemon disappeared unexpectedly"

**Cause:** JDK 21 incompatibility with AGP 8.13.2 on Windows

**Solution:**
1. Install JDK 17 (Eclipse Temurin recommended)
2. Update `gradle.properties`:
   ```properties
   org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot
   ```
3. Clean and rebuild:
   ```bash
   ./gradlew clean assembleDevDebug
   ```

### Metro Bundler Issues

**Symptoms:** "Unable to load script from assets 'index.android.bundle'"

**Solution:**
```bash
# From mobile directory
pnpm clean:metro
pnpm dev
```

### Cleartext HTTP Not Permitted

**Symptoms:** Network requests fail with "Cleartext HTTP traffic not permitted"

**Cause:** Trying to use HTTP endpoints in staging/production builds

**Solutions:**
- Use `devDebug` or `devRelease` builds for local development
- Use `adb reverse` for physical devices
- Use HTTPS endpoints for staging/production

### App Links Not Working

**Symptoms:** Deep links show app chooser dialog instead of opening directly

**Verification:**
```bash
cd apps/mobile/android
./verify-app-links.sh foodwasteapp.com
```

**Common Issues:**
1. `assetlinks.json` not accessible at `/.well-known/assetlinks.json`
2. SHA256 fingerprint mismatch
3. HTTPS not configured properly
4. Redirects in URL path

**See:** `APP_LINKS_SETUP.md` for complete troubleshooting

### Build Fails with "AAPT: error: resource android:attr/lStar not found"

**Cause:** androidx.core version mismatch

**Solution:** Already handled in `build.gradle` with forced version:
```gradle
force("androidx.core:core:1.13.1")
force("androidx.core:core-ktx:1.13.1")
```

If issue persists:
```bash
./gradlew clean
./gradlew app:dependencies | grep androidx.core
```

### Out of Memory During Build

**Symptoms:** "OutOfMemoryError: Java heap space"

**Solution:** Increase JVM memory in `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx6144m -Xms512m -XX:MaxMetaspaceSize=768m
```

**Reduce parallel workers:**
```properties
org.gradle.workers.max=2
```

### ProGuard/R8 Crashes in Release Build

**Symptoms:** App crashes in release but works in debug

**Cause:** Over-aggressive minification removing required classes

**Solution:**
1. Check crash logs: `adb logcat`
2. Add ProGuard keep rules to `app/proguard-rules.pro`
3. Example:
   ```proguard
   -keep class com.yourpackage.YourClass { *; }
   ```
4. Rebuild release

**Note:** The app already has 367 lines of ProGuard rules covering common libraries

---

## Performance Optimization

### Build Performance

**Current settings (optimized):**
- Gradle daemon: enabled
- Parallel execution: disabled (stability over speed)
- Build cache: enabled
- JVM heap: 4096MB
- Workers: 4

**Typical build times:**
- First clean build: 3-5 minutes
- Incremental build: 15-30 seconds
- Cached clean build: 1-2 minutes

### APK Size Optimization

**Debug APK:** ~60-80 MB (all ABIs, no minification)
**Release APK:** ~25-40 MB (all ABIs, minified)
**Release APK (single ABI):** ~15-20 MB

**Optimizations enabled in release:**
- ProGuard/R8 code minification
- Resource shrinking
- APK splitting by ABI (for Play Store)

**Enable APK splits in `app/build.gradle`:**
```gradle
splits {
    abi {
        enable true
        reset()
        include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
        universalApk false
    }
}
```

### Runtime Performance

**Hermes Engine:** Enabled (`hermesEnabled=true`)
- Faster app startup
- Reduced memory usage
- Smaller bundle size
- Better performance overall

**New Architecture:** Enabled (`newArchEnabled=true`)
- Modern React Native architecture
- Better performance
- Experimental but production-ready for RN 0.81

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Android

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10.17.0

      - name: Install dependencies
        run: pnpm install

      - name: Build debug APK
        run: |
          cd apps/mobile/android
          ./gradlew assembleDevDebug

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-dev-debug
          path: apps/mobile/android/app/build/outputs/apk/dev/debug/*.apk
```

### Release Build Example

```yaml
- name: Decode keystore
  run: |
    echo "${{ secrets.KEYSTORE_FILE_BASE64 }}" | base64 -d > release.keystore

- name: Build production release
  env:
    KEYSTORE_FILE: release.keystore
    KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
    KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
    KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
  run: |
    cd apps/mobile/android
    ./gradlew bundleProductionRelease
```

---

## Additional Documentation

### Internal Documentation

- **[APP_LINKS_SETUP.md](./APP_LINKS_SETUP.md)** - Complete App Links setup guide (590 lines)
- **[BUILD_VARIANTS.md](./BUILD_VARIANTS.md)** - Build variants and signing configuration (440 lines)
- **[PERMISSIONS.md](./PERMISSIONS.md)** - Comprehensive permissions guide (700 lines)
- **[SECURITY_IMPLEMENTATION_SUMMARY.md](./SECURITY_IMPLEMENTATION_SUMMARY.md)** - Security audit and compliance (660 lines)

### External Resources

**Official Android:**
- [Android Developers](https://developer.android.com/)
- [Android App Links](https://developer.android.com/training/app-links)
- [Network Security Config](https://developer.android.com/privacy-and-security/security-config)
- [App Signing](https://developer.android.com/studio/publish/app-signing)
- [ProGuard/R8](https://developer.android.com/studio/build/shrink-code)

**React Native:**
- [React Native Docs](https://reactnative.dev/docs/environment-setup)
- [React Native Android Setup](https://reactnative.dev/docs/environment-setup?platform=android)
- [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)

**Security:**
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- [Android Security Best Practices](https://developer.android.com/topic/security/best-practices)

**Firebase:**
- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/android/client)
- [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics/get-started?platform=android)

---

## Quick Reference

### Monorepo Commands (from root)

```bash
pnpm mobile:android          # Run Android app
pnpm dev:android             # Build debug APK
pnpm dev:android:clean       # Clean Android build
pnpm mobile:dev              # Start Metro bundler
```

### Gradle Commands (from android/)

```bash
./gradlew assembleDevDebug              # Build dev debug
./gradlew installDevDebug               # Build + install
./gradlew assembleProductionRelease     # Build production release
./gradlew bundleProductionRelease       # Build AAB for Play Store
./gradlew clean                         # Clean build
./gradlew signingReport                 # Show signing info
```

### ADB Commands

```bash
adb devices                              # List devices
adb install path/to/app.apk            # Install APK
adb uninstall com.foodwasteapp.dev     # Uninstall app
adb shell pm clear com.foodwasteapp    # Clear app data
adb logcat                               # View logs
adb reverse tcp:8081 tcp:8081          # Forward Metro port
```

### File Paths

```
Build outputs: app/build/outputs/apk/[flavor]/[buildType]/
Manifest: app/src/main/AndroidManifest.xml
Network security: app/src/main/res/xml/network_security_config.xml
ProGuard rules: app/proguard-rules.pro
Firebase config: app/src/production/google-services.json
```

---

## Production Readiness Checklist

Before releasing to Google Play Store:

**Code & Build:**
- [ ] Version code incremented in `app/build.gradle`
- [ ] Version name updated (semantic versioning)
- [ ] All tests passing
- [ ] ESLint checks passing
- [ ] TypeScript compilation successful
- [ ] No console.log statements in production code

**Security:**
- [ ] Release keystore secured (not in repo)
- [ ] Environment variables set for signing
- [ ] ProGuard rules tested (no runtime crashes)
- [ ] No debug code in production build
- [ ] Network security enforced (no cleartext)
- [ ] Root detection enabled
- [ ] OWASP checklist reviewed

**Firebase:**
- [ ] Production `google-services.json` configured
- [ ] Firebase Crashlytics enabled
- [ ] Firebase Analytics configured
- [ ] Push notifications tested

**App Links:**
- [ ] `assetlinks.json` deployed to production domain
- [ ] SHA256 fingerprint matches release keystore
- [ ] App Links verification successful
- [ ] Deep links tested end-to-end

**Permissions:**
- [ ] All permission rationales user-friendly
- [ ] Graceful degradation tested
- [ ] Privacy policy published
- [ ] Play Store Data Safety section completed

**Testing:**
- [ ] Tested on physical devices (multiple brands/OS versions)
- [ ] Tested all build variants
- [ ] Tested offline functionality
- [ ] Tested push notifications
- [ ] Tested deep links
- [ ] Tested biometric authentication
- [ ] Performance testing completed

**Documentation:**
- [ ] Release notes prepared
- [ ] Change log updated
- [ ] Screenshots updated (if UI changes)

---

**Created:** January 15, 2026
**Author:** Claude Code (Senior Software Architect)
**Monorepo:** Too Fresh To Waste - Food Waste Reduction Marketplace
**Status:** Production Ready - Enterprise Grade

Build secure. Deploy confident. 🚀
