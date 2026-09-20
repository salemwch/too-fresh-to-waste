/**
 * Auth Stack Navigator
 * Handles all unauthenticated screens
 * Login, Register, Password Recovery, Email Verification, MFA
 *
 * Uses shared getAuthScreenOptions for consistent styling.
 * Register screen keeps its custom header override.
 */

import Icon from '@react-native-vector-icons/ionicons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
// Auth Screens
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import ForceChangePasswordScreen from '@/features/auth/screens/ForceChangePasswordScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { MFAVerificationScreen } from '@/features/auth/screens/MFAVerificationScreen';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from '@/features/auth/screens/VerifyEmailScreen';
import { VerifyPhoneScreen } from '@/features/auth/screens/VerifyPhoneScreen';
import { OnboardingScreen } from '@/features/auth/screens/OnboardingScreen';
import { useAppSelector } from '@/hooks/redux';
import { onboardingStorage } from '@/storage/onboardingStorage';

import { getAuthScreenOptions } from './headerConfig';

import type { AuthStackParamList } from './types';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

interface AuthStackProps {
  /** Override the initial route. Used by RootNavigator for hard-wall screens. */
  initialRouteName?: Extract<keyof AuthStackParamList, string>;
}

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Auth Stack Component
 * Navigation stack for authentication flows
 *
 * BEST PRACTICE: Static initial route + Imperative navigation
 * - initialRouteName is always 'Login' to prevent stack resets on re-renders
 * - Navigation between screens uses imperative navigation.navigate() calls
 * - Redux state provides fallback data for deep linking and session restoration
 * - This follows React Navigation official recommendations
 *
 * @see https://reactnavigation.org/docs/navigating#navigate-to-a-route-multiple-times
 */
/**
 * Module scope: every rule here is static, so calling StyleSheet.create inside
 * the component was rebuilding the sheet on each render for no benefit — and it
 * put the styles out of reach of the hoisted CustomHeader above.
 */
const styles = StyleSheet.create({
  headerContainer: {
    paddingBottom: 0,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    padding: 5,
  },
  headerTitle: {
    marginStart: 16,
  },
});

/**
 * Stack header with safe-area padding.
 *
 * Module scope, not inside AuthStack: a component declared in a render body has
 * a new type identity each render, so React remounts its subtree rather than
 * updating it — and this one is passed to the navigator's `header` option, so
 * it would remount on every navigation state change. Reads theme and insets
 * itself rather than closing over the parent's.
 */
const CustomHeader = ({
  navigation,
  title,
}: {
  navigation: NativeStackHeaderProps['navigation'];
  title: string;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top + 3,
        },
      ]}
    >
      <Pressable
        accessibilityRole='button'
        onPress={() => navigation.goBack()}
        style={styles.headerBackButton}
      >
        <Icon name='arrow-back' size={24} color={theme.colors.onSurface} />
      </Pressable>
      <Text
        variant='headline.medium'
        weight='semibold'
        style={[styles.headerTitle, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>
    </View>
  );
};

export const AuthStack: React.FC<AuthStackProps> = ({ initialRouteName }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // SYNCHRONOUS onboarding check - determines initial route
  // Device-level flag that persists across login/logout
  const hasSeenWelcome = onboardingStorage.hasSeenWelcome();

  // Access Redux state for fallback data (deep linking, session restoration)
  // This is NOT used for navigation logic, only for initial params
  const pendingVerificationEmail = useAppSelector(state => state.auth?.pendingVerificationEmail);

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName ?? (hasSeenWelcome ? 'Login' : 'Welcome')}
      screenOptions={getAuthScreenOptions(theme)}
    >
      {/*
        Onboarding - ONLY for first-time users (device-level flag).

        One route, three pages. It used to be three routes; the pager needs
        them in a single scroll container to follow the finger. See
        features/auth/screens/OnboardingScreen.tsx.
      */}
      {!hasSeenWelcome && (
        <Stack.Screen
          name='Welcome'
          component={OnboardingScreen}
          options={{
            headerShown: false,
            title: 'Welcome',
            statusBarStyle: 'light',
            gestureEnabled: false,
          }}
        />
      )}

      {/* Login Screen */}
      <Stack.Screen
        name='Login'
        component={LoginScreen}
        options={{
          headerShown: false,
          title: 'Login',
        }}
      />

      {/* Register Screen */}
      <Stack.Screen
        name='Register'
        component={RegisterScreen}
        options={({ navigation }) => ({
          headerShown: true,
          header: () => <CustomHeader navigation={navigation} title={t('auth.signUp')} />,
        })}
      />

      {/* Forgot Password Screen */}
      <Stack.Screen
        name='ForgotPassword'
        component={ForgotPasswordScreen}
        options={{
          headerShown: true,
          title: 'Reset Password',
          headerBackTitle: 'Back',
        }}
      />

      {/* Reset Password Screen */}
      <Stack.Screen
        name='ResetPassword'
        component={ResetPasswordScreen}
        options={{
          headerShown: true,
          title: 'Create New Password',
          headerBackTitle: 'Cancel',
          gestureEnabled: true,
        }}
      />

      {/* Email Verification Screen */}
      <Stack.Screen
        name='VerifyEmail'
        component={VerifyEmailScreen}
        options={{
          headerShown: true,
          title: 'Verify Email',
          headerBackTitle: 'Back',
          // Prevent going back until email is verified
          gestureEnabled: false,
          headerBackVisible: false,
        }}
        // initialParams provides fallback for deep linking and session restoration
        // Normal flow: RegisterScreen calls navigation.navigate('VerifyEmail', { email: '...' })
        // Fallback: Deep link or app restart uses Redux state
        initialParams={{ email: pendingVerificationEmail ?? '' }}
      />

      {/* Phone Verification Screen */}
      <Stack.Screen
        name='VerifyPhone'
        component={VerifyPhoneScreen}
        options={{
          headerShown: true,
          title: 'Verify Phone Number',
          headerBackTitle: 'Back',
          // Allow back navigation with confirmation
          gestureEnabled: true,
        }}
      />

      {/* MFA Verification Screen */}
      <Stack.Screen
        name='MFAVerification'
        component={MFAVerificationScreen}
        options={{
          headerShown: true,
          title: 'Two-Factor Authentication',
          headerBackTitle: 'Back',
          // Prevent going back during MFA flow
          gestureEnabled: false,
          headerBackVisible: false,
        }}
      />

      {/* Force Change Password Screen — hard wall for admin-created accounts */}
      <Stack.Screen
        name='ForceChangePassword'
        component={ForceChangePasswordScreen}
        options={{
          headerShown: false,
          // Hard wall: no swipe-back gesture allowed
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};
