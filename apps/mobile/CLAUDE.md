# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Too Fresh To Waste - React Native 0.81 mobile app for a food waste reduction
marketplace. Monorepo member (`@foodwaste/mobile`) with shared packages at
`../../packages/shared` and backend at `../food-waste-backend`.

**Stack:** Node.js 24.11.1 | pnpm 10.17.0 | TypeScript 5.8 | React 19.1 | Redux
Toolkit | TanStack Query | React Navigation 6

## Build & Development Commands

```bash
# Development (from apps/mobile/)
pnpm dev                    # Start Metro bundler
pnpm dev:android            # Run on Android device/emulator
pnpm dev:ios                # Run on iOS simulator (macOS only)
pnpm metro:reset            # Start Metro with cache reset

# From monorepo root (preferred)
pnpm mobile:dev             # Start Metro via Turborepo
pnpm mobile:android         # Run Android via Turborepo
pnpm mobile:ios             # Run iOS via Turborepo

# Quality Checks
pnpm lint                   # ESLint check
pnpm lint:fix               # ESLint autofix
pnpm type-check             # TypeScript validation (tsc --noEmit)
pnpm format                 # Prettier format src/**

# Testing
pnpm test                   # Run all tests (Jest)
pnpm test:watch             # Watch mode for TDD
pnpm test:unit              # Run __tests__/unit/**
pnpm test:integration       # Run __tests__/integration/**
pnpm test:ci                # CI mode with coverage

# Building
pnpm build:android:debug    # Debug APK (android/app/build/outputs/apk/debug/)
pnpm build:android:release  # Release APK
pnpm bundle:android         # Create JS bundle for Android
pnpm bundle:size            # Analyze bundle size

# Cleaning
pnpm clean                  # Full project clean
pnpm clean:metro            # Clear Metro cache only
pnpm android:clean          # Gradle clean
```

## Architecture

### Provider Hierarchy (App.tsx)

```
GestureHandlerRootView → SafeAreaProvider → ReduxProvider → PersistGate
  → QueryProvider (TanStack) → ThemeProvider → RootNavigator
```

### Directory Structure

```
src/
├── App.tsx                 # Root component with provider stack
├── design-system/          # Atomic design components (atoms/molecules/organisms)
│   ├── tokens/             # Colors, typography, spacing
│   ├── components/         # Button, Text, Card, Input, etc.
│   └── providers/          # ThemeProvider, useTheme hook
├── features/               # Feature modules (vertical slices)
│   ├── auth/               # Login, register, email/phone verification, MFA
│   ├── donations/          # Food donation flows
│   ├── establishments/     # Restaurant/merchant views
│   ├── favorites/          # User favorites
│   ├── home/               # Home screen
│   ├── map/                # Map-based discovery
│   ├── notifications/      # Push notification handling
│   ├── offers/             # Surplus food listings
│   ├── orders/             # Order management
│   ├── profile/            # User profile
│   └── search/             # Search functionality
├── navigation/             # React Navigation config
│   ├── RootNavigator.tsx   # State-driven auth routing
│   ├── AuthStack.tsx       # Unauthenticated screens
│   ├── MainStack.tsx       # Authenticated screens
│   └── TabNavigator.tsx    # Bottom tab navigation
├── store/                  # Redux store + redux-persist
├── services/               # API clients, biometric, secure storage
├── hooks/                  # Custom React hooks
├── lib/                    # Third-party integrations (react-query)
├── config/                 # Environment configuration
└── utils/                  # Utility functions, logger
```

### Feature Module Structure

Each feature follows this pattern:

```
features/<feature>/
├── screens/         # Screen components
├── components/      # Feature-specific components
├── hooks/           # Feature-specific hooks
├── services/        # API service layer
├── store/           # Redux slice (if stateful)
└── types/           # TypeScript types
```

### State Management

- **Redux Toolkit** with `redux-persist` for global state (auth persisted to
  AsyncStorage)
- **TanStack Query** for server state (data fetching, caching, synchronization)
- **React Hook Form** + **Yup** for form state and validation

### Navigation (State-Driven)

Navigation is driven by `AuthFlowState` enum in Redux:

| State                        | Screen                               |
| ---------------------------- | ------------------------------------ |
| `AUTHENTICATED`              | MainStack (tabs, home, offers, etc.) |
| `UNAUTHENTICATED`            | AuthStack → Login                    |
| `EMAIL_VERIFICATION_PENDING` | AuthStack → VerifyEmail              |
| `PHONE_VERIFICATION_PENDING` | AuthStack → VerifyPhone              |
| `MFA_REQUIRED`               | AuthStack → MFA                      |
| `SESSION_EXPIRED`            | AuthStack → Login (with message)     |

### Design System

Uses atomic design with tokens:

```tsx
import { Button, Text, Card, useTheme } from '@/design-system';
import { colorTokens, spacingTokens } from '@/design-system/tokens';

// Typography variants: display.large, headline.medium, body.medium, label.small
<Text variant="body.medium">Content</Text>

// Button variants: primary, secondary, tertiary, ghost, outline, danger, success
<Button variant="primary" size="md" onPress={handlePress}>Submit</Button>
```

### Environment Configuration

Uses `react-native-config` with `.env` files:

```bash
# Key variables (see src/config/environment.ts for full list)
API_BASE_URL=http://localhost:3000/api/v1
WEBSOCKET_URL=ws://localhost:3000
ENVIRONMENT=development|staging|production
```

## Path Aliases

Defined in `tsconfig.json`, `babel.config.js`, and `metro.config.js`:

```typescript
import { Something } from '@foodwaste/shared'; // ../../packages/shared/src
import { Something } from '@/components/Button'; // ./src/components/Button
import { Something } from '@/features/auth'; // ./src/features/auth
import { Something } from '@/services/api'; // ./src/services/api
```

## Testing

- **Jest** with `@testing-library/react-native`
- **Detox** for E2E (when configured)
- Design system provides `renderWithTheme` helper for testing themed components

```tsx
import { renderWithTheme } from '@/design-system/setupTests';

test('renders correctly', () => {
  const { getByText } = renderWithTheme(<MyComponent />);
  expect(getByText('Hello')).toBeTruthy();
});
```

## Key Patterns

### API Calls

Use TanStack Query with services layer:

```tsx
// services/authService.ts exports API functions
// hooks/useAuth.ts wraps with useQuery/useMutation
const { mutate: login, isLoading } = useLogin();
```

### Secure Storage

Sensitive data stored via `react-native-keychain`:

```tsx
import { SecureStorage } from '@/services/SecureStorage';
await SecureStorage.setTokens(accessToken, refreshToken);
```

### Biometric Auth

```tsx
import { BiometricAuth } from '@/services/BiometricAuth';
const result = await BiometricAuth.authenticate('Unlock app');
```

## Known Considerations

- Metro must watch workspace root for shared package hot reloading
- iOS builds require macOS with Xcode
- Android builds require JDK 17+ and Android SDK
- Monorepo: always run `pnpm install` from workspace root
- Shared package changes require Metro cache reset if not picking up changes
