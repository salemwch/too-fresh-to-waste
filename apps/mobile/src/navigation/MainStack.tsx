/**
 * Main Stack Navigator
 * Handles all authenticated screens and modals
 * Contains the bottom tab navigator and modal screens
 *
 * Uses shared headerConfig for consistent NativeStack styling.
 *
 * NOTE: Direct imports used instead of React.lazy() due to Metro bundler
 * incompatibility (facebook/metro#1019). Metro's inlineRequires handles
 * lazy loading at the module level automatically.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/design-system/providers';
import { EstablishmentDetailsScreen } from '@/features/establishments/screens/EstablishmentDetailsScreen';
import { DonationImpactScreen } from '@/features/donations/screens/DonationImpactScreen';
import { LeaderboardScreen } from '@/features/leaderboard/screens/LeaderboardScreen';
import { LoyaltyScreen } from '@/features/loyalty/screens/LoyaltyScreen';
import { OfferDetailsScreen } from '@/features/offers/screens/OfferDetailsScreen';
import { CheckoutScreen } from '@/features/orders/screens/CheckoutScreen';
import { OrderHistoryScreen } from '@/features/orders/screens/OrderHistoryScreen';
import { PrivacyScreen } from '@/features/profile/screens/PrivacyScreen';
import { SecurityScreen } from '@/features/profile/screens/SecurityScreen';
import { SettingsScreen } from '@/features/profile/screens/SettingsScreen';

import {
  getDefaultScreenOptions,
  getModalScreenOptions,
  makeHeaderBackButton,
} from './headerConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { TabNavigator } from './TabNavigator';

import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Main Stack Component
 * Protected navigation stack for authenticated users
 */
export const MainStack: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  const defaultOptions = (navigation: { goBack: () => void }) => ({
    ...getDefaultScreenOptions(theme),
    headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
  });
  const modalOptions = (navigation: { goBack: () => void }) => ({
    ...getModalScreenOptions(theme),
    headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
  });
  const protectedScreenLayout = ({ children }: { children: React.ReactNode }) => (
    <ProtectedRoute>{children}</ProtectedRoute>
  );

  return (
    <Stack.Navigator initialRouteName='MainTabs' screenOptions={{ headerShown: false }}>
      <Stack.Screen name='MainTabs' component={TabNavigator} />

      <Stack.Group
        screenOptions={({ navigation }) => ({ ...modalOptions(navigation), headerShown: true })}
      >
        <Stack.Screen
          name='OfferDetails'
          component={OfferDetailsScreen}
          options={{ title: t('navigation.offerDetails') }}
        />
      </Stack.Group>

      <Stack.Group
        screenLayout={protectedScreenLayout}
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen
          name='OrderHistory'
          component={OrderHistoryScreen}
          options={{ title: t('navigation.orderHistory') }}
        />
        <Stack.Screen
          name='Checkout'
          component={CheckoutScreen}
          options={{ title: t('navigation.checkout'), presentation: 'modal' }}
        />
      </Stack.Group>

      <Stack.Group
        screenLayout={protectedScreenLayout}
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen
          name='Leaderboard'
          component={LeaderboardScreen}
          options={{ title: t('navigation.leaderboard') }}
        />
        <Stack.Screen
          name='Loyalty'
          component={LoyaltyScreen}
          options={{ title: t('navigation.myPoints') }}
        />
        <Stack.Screen
          name='DonationImpact'
          component={DonationImpactScreen}
          options={{ title: t('navigation.communityImpact') }}
        />
      </Stack.Group>

      <Stack.Group
        screenLayout={protectedScreenLayout}
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen
          name='Settings'
          component={SettingsScreen}
          options={{ title: t('navigation.settings') }}
        />
        <Stack.Screen
          name='Privacy'
          component={PrivacyScreen}
          options={{ title: t('navigation.privacyData') }}
        />
        <Stack.Screen
          name='Security'
          component={SecurityScreen}
          options={{ title: t('navigation.security') }}
        />
      </Stack.Group>

      <Stack.Group
        screenLayout={protectedScreenLayout}
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen
          name='EstablishmentDetails'
          component={EstablishmentDetailsScreen}
          options={{ title: t('navigation.establishmentDetails') }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
};
