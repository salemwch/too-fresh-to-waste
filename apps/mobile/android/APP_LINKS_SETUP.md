# Android App Links Setup - Enterprise Guide

**Last Updated:** October 18, 2025
**Documentation:** https://developer.android.com/training/app-links
**Package Name:** `com.foodwasteapp`
**Domains:** `foodwasteapp.com`, `www.foodwasteapp.com`

---

## Overview

Android App Links allow your app to be the default handler for HTTPS URLs from your website. This provides a seamless user experience where clicking `https://foodwasteapp.com/food/123` opens directly in your app instead of the browser.

**Benefits:**
- ✓ Seamless user experience (no disambiguation dialog)
- ✓ Verified app ownership (Digital Asset Links)
- ✓ Improved deep linking from web to app
- ✓ Better SEO and user engagement

---

## Current Configuration

**AndroidManifest.xml:**
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="foodwasteapp.com" />
    <data android:scheme="https" android:host="www.foodwasteapp.com" />
</intent-filter>
```

**Location:** `apps/mobile/android/app/src/main/AndroidManifest.xml:38-44`

**Key Attribute:**
- `android:autoVerify="true"` - Enables automatic App Links verification
- Android will verify app ownership when app is installed

---

## Step 1: Get Your Release Keystore Fingerprint

### For Existing Keystore

If you already have a release keystore:

```bash
# Navigate to your keystore location
cd ~/.android  # or wherever your keystore is stored

# Get SHA256 fingerprint
keytool -list -v -keystore release.keystore -alias foodwaste_release_key

# Output will include:
# Certificate fingerprints:
#      SHA1: XX:XX:XX:...
#      SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
```

**Copy the SHA256 fingerprint** (64 hex characters with colons)

### For New Keystore

If you don't have a release keystore yet:

```bash
# Generate new release keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore release.keystore \
  -alias foodwaste_release_key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_SECURE_PASSWORD \
  -keypass YOUR_SECURE_KEY_PASSWORD \
  -dname "CN=Food Waste App, OU=Mobile, O=Your Company, L=Your City, ST=Your State, C=US"

# Then get the SHA256 fingerprint
keytool -list -v -keystore release.keystore -alias foodwaste_release_key
```

**⚠️ CRITICAL SECURITY:**
- Never commit keystore to version control
- Store keystore password in secure password manager
- Keep backup of keystore in secure location
- Losing keystore means you cannot update your app on Play Store

---

## Step 2: Create Digital Asset Links File

### File Location

The Digital Asset Links file MUST be served at:
```
https://foodwasteapp.com/.well-known/assetlinks.json
https://www.foodwasteapp.com/.well-known/assetlinks.json
```

**Requirements:**
- ✓ HTTPS only (HTTP will NOT work)
- ✓ No redirects (must be direct 200 OK response)
- ✓ Content-Type: `application/json`
- ✓ Accessible without authentication
- ✓ File size < 100KB

### File Content

**Template location:** `apps/mobile/android/app/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.foodwasteapp",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
    ]
  }
}]
```

**Replace `AA:BB:CC:...` with your actual SHA256 fingerprint from Step 1**

### For Multiple Build Variants

If you have different keystores for dev/staging/production:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.foodwasteapp",
      "sha256_cert_fingerprints": [
        "PRODUCTION_RELEASE_KEY_SHA256"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.foodwasteapp.dev",
      "sha256_cert_fingerprints": [
        "DEV_DEBUG_KEY_SHA256"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.foodwasteapp.staging",
      "sha256_cert_fingerprints": [
        "STAGING_RELEASE_KEY_SHA256"
      ]
    }
  }
]
```

---

## Step 3: Deploy to Web Server

### Option A: Static Web Server

**Nginx configuration:**
```nginx
server {
    listen 443 ssl;
    server_name foodwasteapp.com www.foodwasteapp.com;

    # SSL certificates
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Serve assetlinks.json
    location /.well-known/assetlinks.json {
        alias /var/www/foodwasteapp/.well-known/assetlinks.json;
        default_type application/json;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=3600";
    }

    # Rest of your site config...
}
```

**Apache configuration:**
```apache
<VirtualHost *:443>
    ServerName foodwasteapp.com
    ServerAlias www.foodwasteapp.com

    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key

    <Directory "/var/www/foodwasteapp/.well-known">
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        <Files "assetlinks.json">
            Header set Content-Type "application/json"
            Header set Access-Control-Allow-Origin "*"
            Header set Cache-Control "public, max-age=3600"
        </Files>
    </Directory>
</VirtualHost>
```

### Option B: Firebase Hosting

**firebase.json:**
```json
{
  "hosting": {
    "public": "public",
    "rewrites": [],
    "headers": [
      {
        "source": "/.well-known/assetlinks.json",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Cache-Control",
            "value": "public, max-age=3600"
          }
        ]
      }
    ]
  }
}
```

**Deploy:**
```bash
# Place assetlinks.json in public/.well-known/
mkdir -p public/.well-known
cp apps/mobile/android/app/assetlinks.json public/.well-known/

# Deploy
firebase deploy --only hosting
```

### Option C: Vercel/Netlify

**public/.well-known/assetlinks.json** (place file here)

**vercel.json:**
```json
{
  "headers": [
    {
      "source": "/.well-known/assetlinks.json",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    }
  ]
}
```

---

## Step 4: Verify Configuration

### Online Verification Tool

**Google App Links Tester:**
```
https://developers.google.com/digital-asset-links/tools/generator
```

**Steps:**
1. Enter domain: `foodwasteapp.com`
2. Enter package name: `com.foodwasteapp`
3. Enter SHA256 fingerprint
4. Click "Generate Statement"
5. Click "Test Statement"

### Command Line Verification

**Check file accessibility:**
```bash
# Test direct access
curl -I https://foodwasteapp.com/.well-known/assetlinks.json

# Should return:
# HTTP/2 200
# Content-Type: application/json

# Test file content
curl https://foodwasteapp.com/.well-known/assetlinks.json | jq
```

**Expected response:**
```bash
HTTP/2 200
content-type: application/json
content-length: 342
cache-control: public, max-age=3600
```

### Device Verification

**After installing app on device:**

```bash
# Check App Links status
adb shell pm get-app-links com.foodwasteapp

# Output shows verification status:
# com.foodwasteapp:
#   ID: 12345678-1234-1234-1234-123456789012
#   Signatures: [AA:BB:CC:...]
#   Domain verification state:
#     foodwasteapp.com: verified
#     www.foodwasteapp.com: verified

# If verification failed:
# Domain verification state:
#     foodwasteapp.com: legacy_failure
#     www.foodwasteapp.com: legacy_failure
```

**Manual verification trigger:**
```bash
# Force re-verification
adb shell pm verify-app-links --re-verify com.foodwasteapp

# Check status again
adb shell pm get-app-links com.foodwasteapp
```

---

## Step 5: Test App Links

### Test Deep Links

```bash
# Test custom URL scheme (always works)
adb shell am start -a android.intent.action.VIEW \
  -d "foodwaste://food/123" \
  com.foodwasteapp

# Test App Link (requires verification)
adb shell am start -a android.intent.action.VIEW \
  -d "https://foodwasteapp.com/food/123"

# If verified: Opens directly in app
# If not verified: Shows app chooser dialog
```

### Test from Browser

1. Open Chrome on device
2. Navigate to: `https://foodwasteapp.com/food/123`
3. If App Links verified: App opens automatically
4. If not verified: User sees "Open with" dialog

### Test from Email/SMS

Send yourself a link:
```
https://foodwasteapp.com/food/123
```

Click link → App should open directly

---

## Troubleshooting

### Issue: "legacy_failure" verification status

**Causes:**
1. File not accessible at `/.well-known/assetlinks.json`
2. HTTPS not configured properly
3. Content-Type not `application/json`
4. Redirects in URL path
5. SHA256 fingerprint mismatch

**Solutions:**
```bash
# 1. Check file accessibility
curl -v https://foodwasteapp.com/.well-known/assetlinks.json

# 2. Verify Content-Type
curl -I https://foodwasteapp.com/.well-known/assetlinks.json | grep -i content-type

# 3. Check for redirects (should be 200, not 301/302)
curl -IL https://foodwasteapp.com/.well-known/assetlinks.json

# 4. Verify SHA256 matches
keytool -list -v -keystore release.keystore -alias foodwaste_release_key | grep SHA256

# 5. Force re-verification
adb shell pm verify-app-links --re-verify com.foodwasteapp
```

### Issue: App Links not working in debug builds

**Cause:** Debug keystore has different SHA256 than release keystore

**Solution:** Add debug keystore fingerprint to assetlinks.json:

```bash
# Get debug keystore SHA256
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android

# Add to assetlinks.json
```

### Issue: Verification works but links open in browser

**Cause:** Default app handler not set

**Solution:**
```bash
# Reset default handlers
adb shell pm clear-default-handlers com.android.chrome

# Set your app as default
adb shell pm set-app-links --package com.foodwasteapp 0 all
```

---

## React Native Integration

### Handle Deep Links in App

**App.tsx:**
```typescript
import {Linking} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';

function App() {
  const linking = {
    prefixes: [
      'foodwaste://',
      'https://foodwasteapp.com',
      'https://www.foodwasteapp.com',
    ],
    config: {
      screens: {
        Home: '',
        FoodDetails: 'food/:id',
        DonationRequest: 'donation/:id',
        Profile: 'profile/:userId',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {/* Your navigation stack */}
    </NavigationContainer>
  );
}
```

### Handle Initial URL

```typescript
useEffect(() => {
  // Handle initial URL (app opened from link)
  Linking.getInitialURL().then(url => {
    if (url) {
      console.log('App opened from URL:', url);
      // Navigation handled by React Navigation
    }
  });

  // Handle URLs while app is running
  const subscription = Linking.addEventListener('url', ({url}) => {
    console.log('Received URL:', url);
    // Navigation handled by React Navigation
  });

  return () => subscription.remove();
}, []);
```

---

## Production Deployment Checklist

- [ ] Release keystore generated and backed up securely
- [ ] SHA256 fingerprint extracted from release keystore
- [ ] `assetlinks.json` created with correct SHA256
- [ ] File deployed to `https://foodwasteapp.com/.well-known/assetlinks.json`
- [ ] File deployed to `https://www.foodwasteapp.com/.well-known/assetlinks.json`
- [ ] HTTPS properly configured on web server
- [ ] Content-Type set to `application/json`
- [ ] File accessible without authentication
- [ ] No redirects in URL path
- [ ] Verified with Google App Links Tester
- [ ] Tested on physical device with production APK
- [ ] Verification status shows "verified" (not "legacy_failure")
- [ ] Deep links tested from browser, email, SMS
- [ ] React Navigation configured for deep linking

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Verify App Links

on:
  push:
    branches: [main]

jobs:
  verify-app-links:
    runs-on: ubuntu-latest
    steps:
      - name: Check assetlinks.json accessibility
        run: |
          # Check primary domain
          curl -f -I https://foodwasteapp.com/.well-known/assetlinks.json

          # Check www subdomain
          curl -f -I https://www.foodwasteapp.com/.well-known/assetlinks.json

          # Verify content
          curl -f https://foodwasteapp.com/.well-known/assetlinks.json | jq .

      - name: Validate JSON format
        run: |
          curl -s https://foodwasteapp.com/.well-known/assetlinks.json | \
            jq -e '.[0].target.package_name == "com.foodwasteapp"'
```

---

## Security Considerations

**Digital Asset Links Security:**
- ✓ File served over HTTPS only (TLS 1.2+)
- ✓ No sensitive data in assetlinks.json (it's public)
- ✓ SHA256 fingerprint is public (not a secret)
- ✓ Keystore itself must remain private

**Best Practices:**
1. Use separate keystores for debug/staging/production
2. Store production keystore in secure location (not in repo)
3. Use environment variables for keystore passwords in CI/CD
4. Enable Play App Signing for additional security
5. Monitor for unauthorized assetlinks.json modifications

---

## Additional Resources

- **Official Documentation:** https://developer.android.com/training/app-links
- **Digital Asset Links Generator:** https://developers.google.com/digital-asset-links/tools/generator
- **App Links Troubleshooting:** https://developer.android.com/training/app-links/verify-android-applinks
- **React Navigation Deep Linking:** https://reactnavigation.org/docs/deep-linking
- **Play App Signing:** https://developer.android.com/studio/publish/app-signing

---

**Created:** October 18, 2025
**Author:** Claude Code (Senior Software Architect)
**Status:** Production Ready
