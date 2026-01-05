# IDE Setup Guide

**Project**: Food Waste App Monorepo **Last Updated**: 2025-10-17 **Purpose**:
Configure VS Code and Android Studio for optimal development experience

---

## Table of Contents

1. [VS Code Setup](#vs-code-setup)
2. [Android Studio Setup](#android-studio-setup)
3. [Troubleshooting](#troubleshooting)

---

## VS Code Setup

### Prerequisites

- **VS Code**: Version 1.85 or higher
- **Node.js**: 18.x or higher
- **pnpm**: 10.x or higher

### Step 1: Install Recommended Extensions

Open VS Code in the project root and install recommended extensions:

```bash
# Open project
cd C:\WFA
code .

# VS Code will prompt to install recommended extensions
# Click "Install All" when prompted
```

**Essential Extensions**:

- `dbaeumer.vscode-eslint` - ESLint
- `esbenp.prettier-vscode` - Prettier
- `msjsdiag.vscode-react-native` - React Native Tools
- `ms-vscode.vscode-typescript-next` - TypeScript support
- `eamodio.gitlens` - Git integration

### Step 2: Open Workspace

Use the multi-root workspace for better monorepo support:

```bash
# File > Open Workspace from File
# Select: C:\WFA\.vscode\foodwaste.code-workspace
```

**Workspace Benefits**:

- ✅ Separate folders for Mobile, Backend, Shared packages
- ✅ Preconfigured debug configurations
- ✅ Integrated tasks for common operations
- ✅ Proper TypeScript path resolution

### Step 3: Verify Configuration

1. **TypeScript**: Open any `.ts` file and check bottom-right status bar shows
   workspace TypeScript version
2. **ESLint**: Open `apps/mobile/src/App.tsx` - should see ESLint
   warnings/errors
3. **Prettier**: Edit a file and save - should auto-format

### Step 4: Configure Tasks

Access predefined tasks via `Ctrl+Shift+P` → "Tasks: Run Task":

| Task                            | Description                              |
| ------------------------------- | ---------------------------------------- |
| **Mobile: Start Metro**         | Start Metro bundler for React Native     |
| **Mobile: Build Android Debug** | Build Android APK (debug)                |
| **Mobile: Run Android**         | Run app on Android emulator/device       |
| **Backend: Start Dev**          | Start NestJS backend in watch mode       |
| **Root: Lint All**              | Lint all packages                        |
| **Root: Type Check All**        | TypeScript type checking across monorepo |

### Step 5: Configure Debugging

#### Android Debugging

1. Start Metro bundler:

   ```bash
   pnpm --filter @foodwaste/mobile metro
   ```

2. Start Android emulator or connect device

3. Press `F5` or select **"Android: Debug Mobile App"** from debug panel

4. Set breakpoints in TypeScript files

#### Backend Debugging

1. Press `F5` or select **"Backend: Debug NestJS"** from debug panel
2. Set breakpoints in backend TypeScript files
3. Backend runs on http://localhost:3000

#### Full Stack Debugging

1. Select **"Full Stack: Mobile + Backend"** from debug panel
2. Starts both Mobile and Backend debuggers simultaneously

---

## Android Studio Setup

### Prerequisites

- **Android Studio**: Ladybug 2024.2.1 or higher
- **JDK**: 17 (bundled with Android Studio)
- **Android SDK**: API 35 (compileSdk)
- **NDK**: 27.2.12479018

### Step 1: Import Project

1. **Open Android Studio**
2. **File** → **Open**
3. Navigate to: `C:\WFA\apps\mobile\android`
4. Click **OK**

**IMPORTANT**: Open the `android` folder, NOT the project root. Android Studio
needs to see the Gradle files directly.

### Step 2: Initial Sync

After opening, Android Studio will automatically:

1. ✅ Download Gradle dependencies
2. ✅ Index project files
3. ✅ Configure build tools

**First-Time Sync Duration**: 5-10 minutes (downloads dependencies)

**Expected Output**:

```
BUILD SUCCESSFUL in Xs
```

### Step 3: Configure SDK

Verify SDK configuration:

1. **File** → **Project Structure** → **SDK Location**
2. **Android SDK location**: Should auto-detect
3. **JDK location**: Should use bundled JDK 17

**Check Installed Components**:

```bash
# Open SDK Manager (Tools → SDK Manager)
# Verify installed:
- Android SDK Platform 35
- Android SDK Build-Tools 35.0.0
- NDK 27.2.12479018
- CMake 3.22.1 or higher
```

### Step 4: Gradle Configuration

Gradle settings are pre-configured in `gradle.properties`:

```properties
# Performance Optimizations
org.gradle.jvmargs=-Xmx4096m -Xms256m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=true
org.gradle.daemon=true
org.gradle.caching=true

# React Native
hermesEnabled=true
newArchEnabled=false
```

**Build Variants**:

- **debug**: Development build with debugging enabled
- **release**: Production build with ProGuard/R8 optimization

### Step 5: Run Configuration

Android Studio auto-creates run configurations:

1. **Top toolbar** → Select **app** configuration
2. **Device dropdown** → Select emulator or connected device
3. Click **Run** (▶️) or **Debug** (🐛)

**Custom Run Configurations**:

| Configuration     | Module | Build Variant |
| ----------------- | ------ | ------------- |
| **app**           | app    | debug         |
| **app (release)** | app    | release       |

### Step 6: Code Style

Configure code style for consistency:

1. **File** → **Settings** → **Editor** → **Code Style**
2. **Kotlin**:
   - Indent: 4 spaces
   - Continuation indent: 4 spaces
3. **Java**:
   - Indent: 4 spaces
   - Continuation indent: 8 spaces

**Import Code Style** (Optional):

- Android Studio includes Kotlin and Java style guides
- **Settings** → **Editor** → **Code Style** → **Kotlin** → **Set from...** →
  **Kotlin style guide**

### Step 7: Useful Plugins

Install recommended plugins:

1. **File** → **Settings** → **Plugins**
2. Search and install:
   - **.env files support** - For environment variable files
   - **Rainbow Brackets** - Bracket pair colorization
   - **Key Promoter X** - Learn keyboard shortcuts

### Step 8: Indexing Performance

For faster indexing on large projects:

1. **File** → **Settings** → **Editor** → **File Types**
2. **Ignore files and folders** (add if not present):
   ```
   node_modules;.gradle;.idea;build;dist;.turbo
   ```

---

## Monorepo-Specific Configuration

### Path Resolution

The monorepo uses workspace protocol for internal dependencies:

```json
{
  "dependencies": {
    "@foodwaste/shared": "workspace:*"
  }
}
```

**TypeScript Paths** (configured in `tsconfig.base.json`):

```json
{
  "compilerOptions": {
    "paths": {
      "@foodwaste/shared": ["./packages/shared/src"],
      "@foodwaste/mobile/*": ["./apps/mobile/src/*"],
      "@foodwaste/backend/*": ["./apps/food-waste-backend/src/*"]
    }
  }
}
```

### pnpm Workspaces

Workspace configuration (`pnpm-workspace.yaml`):

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Key Commands**:

```bash
# Install all dependencies
pnpm install

# Run command in specific workspace
pnpm --filter @foodwaste/mobile <command>

# Run command in all workspaces
pnpm -r <command>

# Add dependency to workspace
pnpm --filter @foodwaste/mobile add <package>
```

---

## Troubleshooting

### VS Code Issues

#### ❌ TypeScript Errors Not Showing

**Solution**:

1. `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
2. Check bottom-right status bar for TypeScript version
3. Ensure workspace TypeScript is being used, not VS Code bundled version

#### ❌ ESLint Not Working

**Solution**:

1. Open Output panel: `Ctrl+Shift+U`
2. Select "ESLint" from dropdown
3. Check for errors in ESLint server output
4. Run: `pnpm install` (may be missing ESLint packages)

#### ❌ Prettier Not Formatting

**Solution**:

1. Check `.prettierrc` exists in project root
2. Verify `esbenp.prettier-vscode` extension installed
3. Set as default formatter:
   - Right-click file → **Format Document With...** → **Configure Default
     Formatter** → **Prettier**

### Android Studio Issues

#### ❌ Gradle Sync Failed

**Solution**:

```bash
# Stop Gradle daemon
cd apps/mobile/android
./gradlew --stop

# Clean build
./gradlew clean --no-daemon

# Retry sync in Android Studio
# File → Sync Project with Gradle Files
```

#### ❌ Cannot Find React Native

**Error**:

```
Could not read script '../node_modules/react-native/...'
```

**Solution**:

1. Ensure pnpm install completed successfully:

   ```bash
   cd C:\WFA
   pnpm install
   ```

2. Verify React Native exists:

   ```bash
   ls apps/mobile/node_modules/react-native
   # Should show package contents
   ```

3. Invalidate caches:
   - **File** → **Invalidate Caches** → **Invalidate and Restart**

#### ❌ NDK Not Found

**Error**:

```
NDK is not configured
```

**Solution**:

1. **Tools** → **SDK Manager** → **SDK Tools** tab
2. Check **NDK (Side by side)**
3. Install version: `27.2.12479018`
4. Update `local.properties`:
   ```properties
   ndk.dir=C\:\\Users\\<USERNAME>\\AppData\\Local\\Android\\Sdk\\ndk\\27.2.12479018
   ```

#### ❌ Build Failing with Memory Error

**Error**:

```
Daemon will be stopped: Out of memory
```

**Solution**:

Already configured in `gradle.properties`, but if issue persists:

1. Increase heap size:

   ```properties
   # Edit apps/mobile/android/gradle.properties
   org.gradle.jvmargs=-Xmx6144m -Xms256m -XX:MaxMetaspaceSize=768m
   ```

2. Reduce parallel workers:

   ```properties
   org.gradle.workers.max=2
   ```

3. Disable daemon for specific build:
   ```bash
   ./gradlew assembleDebug --no-daemon
   ```

### React Native Metro Issues

#### ❌ Metro Bundler Port in Use

**Error**:

```
Error: listen EADDRINUSE: address already in use :::8081
```

**Solution**:

```bash
# Find process using port 8081
netstat -ano | findstr :8081

# Kill the process (replace <PID>)
taskkill /PID <PID> /F

# Or use different port
pnpm --filter @foodwaste/mobile metro -- --port 8082
```

#### ❌ Unable to Resolve Module

**Error**:

```
Unable to resolve module @foodwaste/shared
```

**Solution**:

1. Clear Metro cache:

   ```bash
   pnpm --filter @foodwaste/mobile start -- --reset-cache
   ```

2. Ensure shared package is built:

   ```bash
   pnpm --filter @foodwaste/shared build
   ```

3. Verify workspace link:
   ```bash
   pnpm list --filter @foodwaste/mobile
   # Should show @foodwaste/shared linked
   ```

---

## Quick Reference

### Common Commands

```bash
# Development
pnpm --filter @foodwaste/mobile metro          # Start Metro bundler
pnpm --filter @foodwaste/mobile android        # Run on Android
pnpm --filter @foodwaste/backend start:dev     # Start backend

# Building
pnpm --filter @foodwaste/mobile build:android:debug
pnpm --filter @foodwaste/mobile build:android:release

# Linting & Type Checking
pnpm lint                                       # Lint all packages
pnpm type-check                                 # Type check all packages
pnpm --filter @foodwaste/mobile lint:fix       # Fix lint issues

# Testing
pnpm test                                       # Run all tests
pnpm --filter @foodwaste/mobile test           # Test mobile app
pnpm --filter @foodwaste/backend test          # Test backend

# Cleaning
pnpm --filter @foodwaste/mobile android:clean  # Clean Android build
rm -rf node_modules && pnpm install            # Clean reinstall
```

### Keyboard Shortcuts

**VS Code**:

- `F5` - Start debugging
- `Ctrl+Shift+P` - Command palette
- `Ctrl+` - Toggle terminal
- `Ctrl+Shift+B` - Run build task
- `Ctrl+K Ctrl+T` - Change color theme

**Android Studio**:

- `Shift+F10` - Run
- `Shift+F9` - Debug
- `Ctrl+F9` - Build project
- `Alt+Enter` - Quick fix
- `Ctrl+Alt+L` - Reformat code

---

## Additional Resources

- [React Native Debugging Guide](https://reactnative.dev/docs/debugging)
- [VS Code React Native Tools](https://github.com/microsoft/vscode-react-native)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [pnpm Workspace Documentation](https://pnpm.io/workspaces)

---

**Questions or Issues?** Check the troubleshooting section or create an issue in
the project repository.
