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
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
// Auth Screens
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { MFAVerificationScreen } from '@/features/auth/screens/MFAVerificationScreen';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from '@/features/auth/screens/VerifyEmailScreen';
import { VerifyPhoneScreen } from '@/features/auth/screens/VerifyPhoneScreen';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';
import { useAppSelector } from '@/hooks/redux';
import { onboardingStorage } from '@/storage/onboardingStorage';

import { getAuthScreenOptions } from './headerConfig';

import type { AuthStackParamList } from './types';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

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
export const AuthStack: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // SYNCHRONOUS onboarding check - determines initial route
  // Device-level flag that persists across login/logout
  const hasSeenWelcome = onboardingStorage.hasSeenWelcome();

  // Custom header component with proper safe area handling
  const CustomHeader = ({
    navigation,
    title,
  }: {
    navigation: NativeStackHeaderProps['navigation'];
    title: string;
  }) => (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top + 3,
        },
      ]}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.headerBackButton}>
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
      marginLeft: 16,
    },
  });

  // Access Redux state for fallback data (deep linking, session restoration)
  // This is NOT used for navigation logic, only for initial params
  const pendingVerificationEmail = useAppSelector(state => state.auth?.pendingVerificationEmail);

  return (
    <Stack.Navigator
      initialRouteName={hasSeenWelcome ? 'Login' : 'Welcome'}
      screenOptions={getAuthScreenOptions(theme)}
    >
      {/* Welcome Screen - ONLY for first-time users (device-level onboarding) */}
      {!hasSeenWelcome && (
        <Stack.Screen
          name='Welcome'
          component={WelcomeScreen}
          options={{
            headerShown: false,
            title: 'Welcome',
            // Prevent going back from welcome screen
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
          header: () => <CustomHeader navigation={navigation} title='Sign Up' />,
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
    </Stack.Navigator>
  );
};
