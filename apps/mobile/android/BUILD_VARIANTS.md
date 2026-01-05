# Android Build Variants - Enterprise Configuration

**Last Updated:** October 18, 2025
**React Native:** 0.81.0
**Android Gradle Plugin:** 8.7.3
**Gradle:** 8.11.1

---

## Overview

This document describes the enterprise-grade build variant configuration for the Food Waste Mobile App Android application. The build system supports multiple environments (dev, staging, production) with secure configurations for each.

---

## Build Variants

The Android app uses **Product Flavors** to support three deployment environments:

| Flavor | Application ID | Purpose | Cleartext Traffic |
|--------|---------------|---------|-------------------|
| `dev` | `com.foodwasteapp.dev` | Development and local testing | Allowed ✓ |
| `staging` | `com.foodwasteapp.staging` | Pre-production testing | Blocked ✗ |
| `production` | `com.foodwasteapp` | Live production app | Blocked ✗ |

Combined with **Build Types** (debug, release), this creates **6 build variants**:

```
devDebug          → Development + Debug
devRelease        → Development + Release (minified)
stagingDebug      → Staging + Debug
stagingRelease    → Staging + Release (minified)
productionDebug   → Production + Debug
productionRelease → Production + Release (minified) ← PLAY STORE
```

---

## Build Commands

### Development Builds

```bash
# Debug build for development (fastest iteration)
./gradlew assembleDevDebug

# Release build for development (minified, signed)
./gradlew assembleDevRelease

# Install directly to connected device
./gradlew installDevDebug
```

### Staging Builds

```bash
# Debug build for staging environment
./gradlew assembleStagingDebug

# Release build for staging (pre-production testing)
./gradlew assembleStagingRelease

# Install to device
./gradlew installStagingDebug
```

### Production Builds

```bash
# Production debug (for testing production config)
./gradlew assembleProductionDebug

# Production release (Google Play Store)
./gradlew assembleProductionRelease

# Production AAB bundle (Play Store upload)
./gradlew bundleProductionRelease
```

### Multi-Variant Commands

```bash
# Build all debug variants
./gradlew assembleDebug

# Build all release variants (requires release signing)
./gradlew assembleRelease

# Build all variants
./gradlew assemble

# Clean all builds
./gradlew clean
```

---

## Build Variant Differences

### Development (`dev`)

**Application ID:** `com.foodwasteapp.dev`
**Version Suffix:** `-dev` (e.g., `1.0.0-dev`)
**App Name:** "Food Waste DEV"

**Features:**
- ✓ Cleartext traffic allowed (for local backend testing)
- ✓ Parallel installation with staging/production
- ✓ Debug logging enabled
- ✓ Relaxed security for development

**Use Cases:**
- Local development
- Testing with localhost servers
- Rapid iteration
- Emulator/device testing

### Staging (`staging`)

**Application ID:** `com.foodwasteapp.staging`
**Version Suffix:** `-staging` (e.g., `1.0.0-staging`)
**App Name:** "Food Waste STAGING"

**Features:**
- ✗ Cleartext traffic blocked (secure HTTPS only)
- ✓ Parallel installation with dev/production
- ✓ Production-like configuration
- ✓ Pre-production testing environment

**Use Cases:**
- QA testing
- UAT (User Acceptance Testing)
- Integration testing
- Pre-release validation

### Production (`production`)

**Application ID:** `com.foodwasteapp`
**Version Suffix:** None
**App Name:** "Food Waste"

**Features:**
- ✗ Cleartext traffic blocked (secure HTTPS only)
- ✓ Matches Firebase configuration
- ✓ Full security hardening
- ✓ ProGuard/R8 obfuscation in release builds

**Use Cases:**
- Google Play Store distribution
- Production releases
- Live user traffic

---

## Release Signing Configuration

### Overview

Production release builds **MUST** be signed with a release keystore. The signing configuration is managed via **environment variables** to prevent committing secrets to version control.

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `KEYSTORE_FILE` | Path to release keystore file | `/path/to/release.keystore` |
| `KEYSTORE_PASSWORD` | Keystore password | `your_keystore_password` |
| `KEY_ALIAS` | Key alias name | `foodwaste_release_key` |
| `KEY_PASSWORD` | Key password | `your_key_password` |

### Local Development Setup

**Warning:** Never commit your release keystore to version control!

1. **Generate release keystore** (if not exists):
   ```bash
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore release.keystore \
     -alias foodwaste_release_key \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Set environment variables** (Linux/macOS):
   ```bash
   export KEYSTORE_FILE="$HOME/.android/release.keystore"
   export KEYSTORE_PASSWORD="your_keystore_password"
   export KEY_ALIAS="foodwaste_release_key"
   export KEY_PASSWORD="your_key_password"
   ```

3. **Set environment variables** (Windows PowerShell):
   ```powershell
   $env:KEYSTORE_FILE="C:\Users\YourName\.android\release.keystore"
   $env:KEYSTORE_PASSWORD="your_keystore_password"
   $env:KEY_ALIAS="foodwaste_release_key"
   $env:KEY_PASSWORD="your_key_password"
   ```

4. **Build signed release**:
   ```bash
   ./gradlew assembleProductionRelease
   ```

### CI/CD Setup (GitHub Actions)

**Add secrets to GitHub repository:**
1. Go to Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `KEYSTORE_FILE_BASE64` (base64-encoded keystore)
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

**GitHub Actions workflow example:**
```yaml
name: Build Production Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

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
          ./gradlew assembleProductionRelease

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: production-release-apk
          path: apps/mobile/android/app/build/outputs/apk/production/release/*.apk
```

---

## Output Locations

After building, APKs and AABs are located in:

```
apps/mobile/android/app/build/outputs/

├── apk/
│   ├── dev/
│   │   ├── debug/
│   │   │   └── app-dev-debug.apk
│   │   └── release/
│   │       └── app-dev-release.apk
│   ├── staging/
│   │   ├── debug/
│   │   │   └── app-staging-debug.apk
│   │   └── release/
│   │       └── app-staging-release.apk
│   └── production/
│       ├── debug/
│       │   └── app-production-debug.apk
│       └── release/
│           └── app-production-release.apk (← Google Play)
│
└── bundle/
    ├── devRelease/
    │   └── app-dev-release.aab
    ├── stagingRelease/
    │   └── app-staging-release.aab
    └── productionRelease/
        └── app-production-release.aab (← Google Play upload)
```

---

## Firebase Configuration

Each build variant can have its own Firebase configuration:

```
apps/mobile/android/app/src/
├── dev/
│   └── google-services.json (Development Firebase project)
├── staging/
│   └── google-services.json (Staging Firebase project)
└── production/
    └── google-services.json (Production Firebase project)
```

**Current setup:**
- Production flavor uses the main `google-services.json`
- Dev/Staging can have separate Firebase projects for isolation

**To add flavor-specific Firebase configs:**
1. Create folder: `apps/mobile/android/app/src/dev/`
2. Add `google-services.json` for dev environment
3. Repeat for staging

---

## Security Matrix

| Feature | devDebug | devRelease | stagingDebug | stagingRelease | productionDebug | productionRelease |
|---------|----------|------------|--------------|----------------|-----------------|-------------------|
| Cleartext Traffic | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Debuggable | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ |
| ProGuard/R8 | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ |
| Resource Shrinking | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ |
| Signed (Release) | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ |

---

## Build Optimization

### ProGuard/R8 (Release Builds Only)

Release builds use R8 (full mode) for:
- **Code minification** - Reduces APK size
- **Code obfuscation** - Makes reverse engineering harder
- **Resource shrinking** - Removes unused resources

**Configuration files:**
- `apps/mobile/android/app/proguard-rules.pro` (367 lines)
- Default: `proguard-android-optimize.txt`

### Build Performance

**Gradle daemon and caching enabled:**
- First build: ~3-5 minutes
- Incremental build: ~15-30 seconds
- Cached clean build: ~1-2 minutes

**APK sizes (estimated):**
- Debug APK: ~60-80 MB (all ABIs)
- Release APK: ~25-40 MB (all ABIs, minified)
- Release APK (single ABI): ~15-20 MB

---

## Troubleshooting

### Issue: "Release signing not configured" warning

**Cause:** Environment variables not set for release builds

**Solution:**
```bash
export KEYSTORE_FILE="/path/to/release.keystore"
export KEYSTORE_PASSWORD="your_password"
export KEY_ALIAS="your_alias"
export KEY_PASSWORD="your_key_password"
```

### Issue: Multiple apps installed with same ID

**Cause:** Attempting to install production build when dev/staging already installed

**Solution:** Build variants use different application IDs for parallel installation:
- Dev: `com.foodwasteapp.dev`
- Staging: `com.foodwasteapp.staging`
- Production: `com.foodwasteapp`

### Issue: Firebase configuration missing

**Cause:** `google-services.json` not found for specific flavor

**Solution:**
- Add `google-services.json` to `src/<flavor>/` directory
- Or use shared config in `src/` directory (applies to all flavors)

### Issue: Build fails with "Cleartext HTTP traffic not permitted"

**Cause:** Trying to connect to HTTP endpoint in staging/production build

**Solution:**
- Use dev builds for local development (cleartext allowed)
- Use HTTPS endpoints for staging/production builds

---

## Verification Commands

```bash
# List all available build variants
./gradlew tasks --all | grep assemble

# Check signing configuration
./gradlew signingReport

# Verify build outputs
ls -lh apps/mobile/android/app/build/outputs/apk/production/release/

# Test specific variant
./gradlew installDevDebug
adb shell pm list packages | grep foodwaste
```

---

## Production Release Checklist

Before releasing to Google Play Store:

- [ ] Version code incremented in `build.gradle`
- [ ] Version name updated (semantic versioning)
- [ ] Release notes prepared
- [ ] All tests passing (`./gradlew test`)
- [ ] ProGuard rules tested (no runtime crashes)
- [ ] Firebase Crashlytics configured
- [ ] Release keystore environment variables set
- [ ] Build production release: `./gradlew bundleProductionRelease`
- [ ] Test AAB on internal track
- [ ] Upload to Play Console
- [ ] Monitor crash reports

---

## Additional Resources

- Android Build Variants: https://developer.android.com/build/build-variants
- App Signing: https://developer.android.com/studio/publish/app-signing
- ProGuard/R8: https://developer.android.com/studio/build/shrink-code
- Firebase Multi-Environment: https://firebase.google.com/docs/projects/multiprojects

---

**Generated by:** Claude Code (Senior Software Architect)
**Date:** October 18, 2025
**Build System:** Gradle 8.11.1 + AGP 8.7.3
