#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# iOS Setup Script — Run on macOS only
# Generates the Xcode project from RN 0.81 template and installs pods
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(dirname "$(dirname "$MOBILE_DIR")")"
IOS_DIR="$SCRIPT_DIR"

echo "──────────────────────────────────────────────────"
echo "  Too Fresh To Waste — iOS Setup"
echo "──────────────────────────────────────────────────"
echo ""
echo "Monorepo root: $MONOREPO_ROOT"
echo "Mobile app:    $MOBILE_DIR"
echo "iOS dir:       $IOS_DIR"
echo ""

# ── Pre-flight checks ────────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
  echo "ERROR: This script must be run on macOS."
  exit 1
fi

if ! command -v xcodebuild &>/dev/null; then
  echo "ERROR: Xcode is not installed. Install from the App Store."
  exit 1
fi

if ! command -v pod &>/dev/null; then
  echo "Installing CocoaPods..."
  sudo gem install cocoapods
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  exit 1
fi

echo "✓ All prerequisites met"
echo ""

# ── Step 1: Generate project.pbxproj from RN template ────────────────────────
echo "Step 1: Generating Xcode project..."

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

cd "$TEMP_DIR"
npx --yes @react-native-community/cli init FoodWasteApp \
  --version 0.81.0 \
  --skip-install \
  --skip-git-init \
  --pm npm

# Copy only the project file (we keep our custom AppDelegate, Info.plist, etc.)
cp "$TEMP_DIR/FoodWasteApp/ios/FoodWasteApp.xcodeproj/project.pbxproj" \
   "$IOS_DIR/FoodWasteApp.xcodeproj/project.pbxproj"

echo "✓ project.pbxproj generated"
echo ""

# ── Step 2: Create .xcode.env.local (if not exists) ──────────────────────────
echo "Step 2: Setting up .xcode.env.local..."

if [[ ! -f "$IOS_DIR/.xcode.env.local" ]]; then
  NODE_PATH=$(command -v node)
  echo "export NODE_BINARY=$NODE_PATH" > "$IOS_DIR/.xcode.env.local"
  echo "✓ Created .xcode.env.local pointing to $NODE_PATH"
else
  echo "✓ .xcode.env.local already exists"
fi
echo ""

# ── Step 3: Install pods ─────────────────────────────────────────────────────
echo "Step 3: Installing CocoaPods dependencies..."

cd "$IOS_DIR"

# Ensure node_modules exist (needed for pod install to resolve RN paths)
if [[ ! -d "$MONOREPO_ROOT/node_modules/react-native" ]]; then
  echo "  Running pnpm install first..."
  cd "$MONOREPO_ROOT"
  pnpm install
  cd "$IOS_DIR"
fi

bundle install 2>/dev/null || true
pod install --repo-update

echo ""
echo "✓ Pods installed successfully"
echo ""

# ── Step 4: Verify ───────────────────────────────────────────────────────────
echo "Step 4: Verifying setup..."

if [[ -f "$IOS_DIR/FoodWasteApp.xcworkspace/contents.xcworkspacedata" ]]; then
  echo "✓ FoodWasteApp.xcworkspace created"
else
  echo "ERROR: .xcworkspace was not generated. Check pod install output."
  exit 1
fi

echo ""
echo "──────────────────────────────────────────────────"
echo "  ✓ iOS setup complete!"
echo "──────────────────────────────────────────────────"
echo ""
echo "Next steps:"
echo "  1. Add GoogleService-Info.plist to ios/FoodWasteApp/"
echo "     → Download from Firebase Console → Project Settings → iOS app"
echo ""
echo "  2. Update the reversed client ID in Info.plist"
echo "     → Find REVERSED_CLIENT_ID in GoogleService-Info.plist"
echo "     → Replace 'com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID'"
echo ""
echo "  3. Open in Xcode:"
echo "     open $IOS_DIR/FoodWasteApp.xcworkspace"
echo ""
echo "  4. Configure signing:"
echo "     → Select FoodWasteApp target → Signing & Capabilities"
echo "     → Set Team + Bundle Identifier (com.toofreshtowaste.app)"
echo "     → Add 'Associated Domains' capability"
echo ""
echo "  5. Run on simulator:"
echo "     cd $MOBILE_DIR && pnpm dev:ios"
echo ""
