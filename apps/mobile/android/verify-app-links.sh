#!/bin/bash

################################################################################
# App Links Verification Script
# Verifies Android App Links configuration for Food Waste Mobile App
#
# Usage: ./verify-app-links.sh [domain]
# Example: ./verify-app-links.sh foodwasteapp.com
#
# Documentation: https://developer.android.com/training/app-links
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_NAME="com.foodwasteapp"
DEFAULT_DOMAIN="foodwasteapp.com"
DOMAIN="${1:-$DEFAULT_DOMAIN}"
ASSETLINKS_URL="https://$DOMAIN/.well-known/assetlinks.json"

# Print header
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  App Links Verification Tool${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "Package Name: ${GREEN}$PACKAGE_NAME${NC}"
echo -e "Domain: ${GREEN}$DOMAIN${NC}"
echo -e "AssetLinks URL: ${GREEN}$ASSETLINKS_URL${NC}"
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✓${NC} $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $message"
    else
        echo -e "${RED}✗${NC} $message"
    fi
}

# Function to check command exists
check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
echo ""

DEPS_OK=true

if check_command adb; then
    print_status "OK" "adb found: $(adb --version | head -1)"
else
    print_status "ERROR" "adb not found - Install Android SDK Platform Tools"
    DEPS_OK=false
fi

if check_command curl; then
    print_status "OK" "curl found"
else
    print_status "ERROR" "curl not found - Install curl"
    DEPS_OK=false
fi

if check_command jq; then
    print_status "OK" "jq found"
else
    print_status "WARN" "jq not found - JSON output will not be formatted"
fi

echo ""

if [ "$DEPS_OK" = false ]; then
    echo -e "${RED}Missing required dependencies. Please install them and try again.${NC}"
    exit 1
fi

################################################################################
# 1. Check AndroidManifest.xml Configuration
################################################################################

echo -e "${BLUE}1. Checking AndroidManifest.xml...${NC}"
echo ""

MANIFEST_FILE="app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST_FILE" ]; then
    print_status "ERROR" "AndroidManifest.xml not found at $MANIFEST_FILE"
    exit 1
fi

# Check for android:autoVerify="true"
if grep -q 'android:autoVerify="true"' "$MANIFEST_FILE"; then
    print_status "OK" "android:autoVerify=\"true\" found in manifest"
else
    print_status "ERROR" "android:autoVerify=\"true\" NOT found in manifest"
    echo -e "   ${YELLOW}App Links require autoVerify attribute in intent-filter${NC}"
fi

# Check for HTTPS intent filter
if grep -q 'android:scheme="https"' "$MANIFEST_FILE"; then
    print_status "OK" "HTTPS scheme configured in intent-filter"
else
    print_status "ERROR" "HTTPS scheme NOT found in manifest"
fi

# Check for domain
if grep -q "android:host=\"$DOMAIN\"" "$MANIFEST_FILE"; then
    print_status "OK" "Domain $DOMAIN found in intent-filter"
else
    print_status "WARN" "Domain $DOMAIN not found in manifest (check domain name)"
fi

echo ""

################################################################################
# 2. Check Digital Asset Links File
################################################################################

echo -e "${BLUE}2. Checking Digital Asset Links file...${NC}"
echo ""

# Check file accessibility
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ASSETLINKS_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    print_status "OK" "assetlinks.json accessible (HTTP $HTTP_STATUS)"
else
    print_status "ERROR" "assetlinks.json not accessible (HTTP $HTTP_STATUS)"
    echo -e "   ${YELLOW}File must be served at: $ASSETLINKS_URL${NC}"
    echo -e "   ${YELLOW}Expected HTTP 200, got HTTP $HTTP_STATUS${NC}"

    if [ "$HTTP_STATUS" = "404" ]; then
        echo -e "   ${YELLOW}File not found. Deploy assetlinks.json to /.well-known/ directory${NC}"
    elif [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
        echo -e "   ${RED}Redirects not allowed for assetlinks.json!${NC}"
    fi

    echo ""
    echo -e "${YELLOW}Skipping remaining checks (file not accessible)${NC}"
    exit 1
fi

# Check Content-Type
CONTENT_TYPE=$(curl -s -I "$ASSETLINKS_URL" | grep -i "content-type" | awk '{print $2}' | tr -d '\r')

if [[ "$CONTENT_TYPE" == *"application/json"* ]]; then
    print_status "OK" "Content-Type is application/json"
else
    print_status "WARN" "Content-Type is $CONTENT_TYPE (should be application/json)"
fi

# Download and validate JSON
ASSETLINKS_JSON=$(curl -s "$ASSETLINKS_URL")

# Validate JSON format
if check_command jq; then
    if echo "$ASSETLINKS_JSON" | jq empty 2>/dev/null; then
        print_status "OK" "Valid JSON format"
    else
        print_status "ERROR" "Invalid JSON format"
        echo "$ASSETLINKS_JSON" | jq .
        exit 1
    fi
else
    print_status "WARN" "Cannot validate JSON (jq not installed)"
fi

# Check required fields
if check_command jq; then
    PACKAGE_IN_JSON=$(echo "$ASSETLINKS_JSON" | jq -r '.[0].target.package_name' 2>/dev/null)

    if [ "$PACKAGE_IN_JSON" = "$PACKAGE_NAME" ]; then
        print_status "OK" "Package name matches: $PACKAGE_NAME"
    else
        print_status "ERROR" "Package name mismatch: Expected $PACKAGE_NAME, got $PACKAGE_IN_JSON"
    fi

    SHA256_COUNT=$(echo "$ASSETLINKS_JSON" | jq '.[0].target.sha256_cert_fingerprints | length' 2>/dev/null)

    if [ "$SHA256_COUNT" -gt 0 ]; then
        print_status "OK" "SHA256 fingerprint(s) present: $SHA256_COUNT"

        # Display fingerprints
        echo "$ASSETLINKS_JSON" | jq -r '.[0].target.sha256_cert_fingerprints[]' | while read fingerprint; do
            if [[ "$fingerprint" == "REPLACE_WITH_"* ]]; then
                echo -e "   ${RED}⚠ Fingerprint not replaced: $fingerprint${NC}"
            else
                echo -e "   ${GREEN}→${NC} $fingerprint"
            fi
        done
    else
        print_status "ERROR" "No SHA256 fingerprints found"
    fi
fi

echo ""

################################################################################
# 3. Check Device Connection and App Installation
################################################################################

echo -e "${BLUE}3. Checking device connection...${NC}"
echo ""

# Check if device is connected
DEVICE_COUNT=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')

if [ "$DEVICE_COUNT" -eq 0 ]; then
    print_status "WARN" "No Android devices connected"
    echo -e "   ${YELLOW}Connect a device to verify App Links on device${NC}"
    echo ""
    echo -e "${YELLOW}Verification complete (device checks skipped)${NC}"
    exit 0
elif [ "$DEVICE_COUNT" -gt 1 ]; then
    print_status "WARN" "Multiple devices connected ($DEVICE_COUNT)"
    echo -e "   ${YELLOW}Specify device with 'adb -s DEVICE_ID'${NC}"
    adb devices
    echo ""
    exit 0
else
    print_status "OK" "Device connected"
fi

# Check if app is installed
if adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
    print_status "OK" "App installed on device"
else
    print_status "WARN" "App not installed on device"
    echo -e "   ${YELLOW}Install app to verify App Links: ./gradlew installDevDebug${NC}"
    echo ""
    exit 0
fi

echo ""

################################################################################
# 4. Verify App Links Status on Device
################################################################################

echo -e "${BLUE}4. Checking App Links status on device...${NC}"
echo ""

# Get App Links verification status
APP_LINKS_STATUS=$(adb shell pm get-app-links "$PACKAGE_NAME" 2>&1)

if echo "$APP_LINKS_STATUS" | grep -q "verified"; then
    print_status "OK" "App Links verified on device"
    echo ""
    echo "$APP_LINKS_STATUS" | grep "$DOMAIN"
elif echo "$APP_LINKS_STATUS" | grep -q "legacy_failure"; then
    print_status "ERROR" "App Links verification failed"
    echo ""
    echo "$APP_LINKS_STATUS"
    echo ""
    echo -e "${YELLOW}Common causes:${NC}"
    echo -e "  1. assetlinks.json not accessible via HTTPS"
    echo -e "  2. SHA256 fingerprint mismatch"
    echo -e "  3. Package name mismatch"
    echo -e "  4. Redirects in assetlinks.json URL"
    echo ""
    echo -e "${YELLOW}Try re-verifying:${NC}"
    echo -e "  adb shell pm verify-app-links --re-verify $PACKAGE_NAME"
else
    print_status "WARN" "App Links status unknown"
    echo ""
    echo "$APP_LINKS_STATUS"
fi

echo ""

################################################################################
# 5. Test Deep Links
################################################################################

echo -e "${BLUE}5. Testing deep links...${NC}"
echo ""

echo -e "${YELLOW}Test 1: Custom URL scheme${NC}"
echo -e "Testing: ${GREEN}foodwaste://test${NC}"
adb shell am start -a android.intent.action.VIEW -d "foodwaste://test" "$PACKAGE_NAME" 2>&1 | grep -v "Warning"
if [ $? -eq 0 ]; then
    print_status "OK" "Custom URL scheme works"
else
    print_status "ERROR" "Custom URL scheme failed"
fi
echo ""

echo -e "${YELLOW}Test 2: App Link (HTTPS)${NC}"
echo -e "Testing: ${GREEN}https://$DOMAIN/test${NC}"
adb shell am start -a android.intent.action.VIEW -d "https://$DOMAIN/test" 2>&1 | grep -v "Warning"
if [ $? -eq 0 ]; then
    if echo "$APP_LINKS_STATUS" | grep -q "verified"; then
        print_status "OK" "App Link should open directly in app (verified)"
    else
        print_status "WARN" "App Link opens but requires user selection (not verified)"
    fi
else
    print_status "ERROR" "App Link failed"
fi

echo ""

################################################################################
# Summary
################################################################################

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

if echo "$APP_LINKS_STATUS" | grep -q "verified"; then
    echo -e "${GREEN}✓ App Links are properly configured and verified!${NC}"
    echo ""
    echo -e "Users clicking ${GREEN}https://$DOMAIN/*${NC} will open your app directly."
else
    echo -e "${YELLOW}⚠ App Links configuration incomplete${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Verify assetlinks.json is accessible: $ASSETLINKS_URL"
    echo -e "  2. Replace SHA256 fingerprint in assetlinks.json"
    echo -e "  3. Re-install app and force re-verification:"
    echo -e "     ${GREEN}adb shell pm verify-app-links --re-verify $PACKAGE_NAME${NC}"
    echo -e "  4. Check status again:"
    echo -e "     ${GREEN}adb shell pm get-app-links $PACKAGE_NAME${NC}"
fi

echo ""
echo -e "${BLUE}Documentation: apps/mobile/android/APP_LINKS_SETUP.md${NC}"
echo ""
