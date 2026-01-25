# NDK Setup Guide - React Native 0.81

**Last Updated:** January 15, 2026
**Required NDK Version:** 27.1.12297006
**React Native Version:** 0.81.0

---

## Why NDK 27.1.12297006?

React Native 0.81 requires NDK r27.1 for:
- **16KB page size support** (Google Play requirement starting Nov 1, 2025)
- **Android 16 (API 36) compatibility**
- **ABI compatibility** with React Native core libraries

**Note:** Using NDK 28+ with RN 0.81 causes crashes due to ABI incompatibilities.

---

## Installation Methods

### Method 1: Android Studio SDK Manager (Recommended)

1. **Open Android Studio**
2. **Go to:** Tools → SDK Manager (or File → Settings → Appearance & Behavior → System Settings → Android SDK)
3. **Click on the "SDK Tools" tab**
4. **Check "Show Package Details" (bottom right)**
5. **Expand "NDK (Side by side)"**
6. **Uncheck any currently selected versions**
7. **Check version "27.1.12297006"**
8. **Click "Apply" → "OK"**
9. **Wait for download and installation**

### Method 2: Command Line (sdkmanager)

**Windows:**
```powershell
cd %LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin
sdkmanager --install "ndk;27.1.12297006"
```

**Linux/macOS:**
```bash
cd ~/Android/Sdk/cmdline-tools/latest/bin
./sdkmanager --install "ndk;27.1.12297006"
```

### Method 3: Manual Download

1. **Download from:** https://developer.android.com/ndk/downloads
2. **Find:** NDK r27 LTS (27.1.12297006)
3. **Extract to:** `C:\Users\YourName\AppData\Local\Android\Sdk\ndk\27.1.12297006\`
   - Windows: `%LOCALAPPDATA%\Android\Sdk\ndk\27.1.12297006\`
   - macOS: `~/Library/Android/sdk/ndk/27.1.12297006/`
   - Linux: `~/Android/Sdk/ndk/27.1.12297006/`

---

## Verification

### Check Installed NDK Versions

**Windows:**
```powershell
dir %LOCALAPPDATA%\Android\Sdk\ndk
```

**Linux/macOS:**
```bash
ls ~/Android/Sdk/ndk/
```

**Expected output:**
```
27.1.12297006
```

### Verify build.gradle Configuration

**File:** `apps/mobile/android/build.gradle`
```gradle
buildscript {
    ext {
        ndkVersion = "27.1.12297006"  // ✓ Correct for RN 0.81
    }
}
```

### Test Build

```bash
cd apps/mobile/android
./gradlew clean
./gradlew assembleDevDebug
```

**Expected:** Build completes without NDK download/installation attempts

---

## Troubleshooting

### Issue: Android Studio Still Downloads Wrong Version

**Cause:** Android Studio cache or invalid NDK path

**Solution:**
```bash
# 1. Close Android Studio completely

# 2. Clear Gradle cache
cd apps/mobile/android
./gradlew clean
rm -rf .gradle build app/build

# 3. Restart Android Studio

# 4. Sync Gradle files
```

### Issue: Multiple NDK Versions Installed

**Cause:** Previous installations not removed

**Solution:**
```bash
# List installed NDK versions (sdkmanager)
sdkmanager --list_installed | grep ndk

# Remove old versions
sdkmanager --uninstall "ndk;27.0.12077973"
sdkmanager --uninstall "ndk;26.x.xxxxx"

# Keep only 27.1.12297006
```

### Issue: Build Still Fails with NDK Error

**Cause:** React Native cache or native modules incompatibility

**Solution:**
```bash
# 1. Clean React Native cache
cd apps/mobile
rm -rf node_modules
pnpm install

# 2. Clean Metro cache
pnpm clean:metro

# 3. Clean Android build
cd android
./gradlew clean

# 4. Rebuild native modules
cd ..
pnpm android:clean
pnpm mobile:android
```

### Issue: "NDK not configured" Error

**Cause:** NDK path not in local.properties

**Solution:**
```properties
# apps/mobile/android/local.properties
sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
ndk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk\\ndk\\27.1.12297006
```

---

## 16KB Page Size Compliance

**Google Play Requirement (Nov 1, 2025+):**
All apps targeting Android 15+ must support 16KB page size.

**React Native 0.81 Status:**
✓ Core libraries are 16KB compliant with NDK 27.1.12297006

**Third-Party Libraries:**
Check native module compatibility:
```bash
# Find native libraries in your app
find node_modules -name "*.so" -exec file {} \;

# Check for 16KB alignment
readelf -l path/to/library.so | grep LOAD
```

**Common Incompatible Libraries:**
- `react-native-reanimated` < 3.16.0
- `react-native-vision-camera` < 4.8.0
- Check GitHub issues for specific library versions

---

## CI/CD Configuration

### GitHub Actions

```yaml
name: Build Android

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

      - name: Install NDK 27.1.12297006
        run: |
          echo "y" | sudo ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager \
            --install "ndk;27.1.12297006"

      - name: Verify NDK Installation
        run: |
          ls ${ANDROID_HOME}/ndk/
          cat apps/mobile/android/build.gradle | grep ndkVersion

      - name: Build
        run: |
          cd apps/mobile/android
          ./gradlew assembleDevDebug
```

### GitLab CI

```yaml
build-android:
  stage: build
  script:
    - export ANDROID_HOME=$HOME/android-sdk
    - sdkmanager --install "ndk;27.1.12297006"
    - cd apps/mobile/android
    - ./gradlew assembleDevDebug
```

---

## Release Signing Note

The warning you see:
```
⚠️  WARNING: Release signing not configured. Set KEYSTORE_FILE environment variable for production builds.
```

This is **expected and normal** for debug/dev builds.

**To configure release signing:**
```bash
# Set environment variables (Windows PowerShell)
$env:KEYSTORE_FILE="C:\path\to\release.keystore"
$env:KEYSTORE_PASSWORD="your_password"
$env:KEY_ALIAS="foodwaste_release_key"
$env:KEY_PASSWORD="your_key_password"

# Then build release
./gradlew assembleProductionRelease
```

**See:** `BUILD_VARIANTS.md` for complete signing setup

---

## Additional Resources

**Official Documentation:**
- [Android NDK Downloads](https://developer.android.com/ndk/downloads)
- [React Native 0.81 Blog Post](https://reactnative.dev/blog/2025/08/12/react-native-0.81)
- [16KB Page Size Guide](https://developer.android.com/guide/practices/page-sizes)

**GitHub Issues:**
- [RN Issue #54073: 16KB page size support](https://github.com/facebook/react-native/issues/54073)
- [RN Issue #54886: NDK r27 ABI compatibility](https://github.com/facebook/react-native/issues/54886)

---

**Created:** January 15, 2026
**Status:** Production Ready for React Native 0.81
**Google Play Compliant:** ✓ 16KB page size support

Sources:
- [React Native 0.81 Official Release](https://reactnative.dev/blog/2025/08/12/react-native-0.81)
- [16KB Page Size Support Issue](https://github.com/facebook/react-native/issues/54073)
- [NDK ABI Compatibility Issue](https://github.com/facebook/react-native/issues/54886)
