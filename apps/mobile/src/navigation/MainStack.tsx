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

import { useTheme } from '@/design-system/providers';
// Offer Screens
import { EstablishmentDetailsScreen } from '@/features/establishments/screens/EstablishmentDetailsScreen';
import { LeaderboardScreen } from '@/features/leaderboard/screens/LeaderboardScreen';
import { LoyaltyScreen } from '@/features/loyalty/screens/LoyaltyScreen';
import { NearbyOffersScreen } from '@/features/map/screens/NearbyOffersScreen';
import { OfferDetailsScreen } from '@/features/offers/screens/OfferDetailsScreen';
// Order Screens (OrderDetailsScreen moved to OrdersStack)
import { CheckoutScreen } from '@/features/orders/screens/CheckoutScreen';
import { OrderHistoryScreen } from '@/features/orders/screens/OrderHistoryScreen';
// Profile Screens (EditProfile moved to ProfileStack)
import { PrivacyScreen } from '@/features/profile/screens/PrivacyScreen';
import { SecurityScreen } from '@/features/profile/screens/SecurityScreen';
import { SettingsScreen } from '@/features/profile/screens/SettingsScreen';

import { getDefaultScreenOptions, getModalScreenOptions, makeHeaderBackButton } from './headerConfig';
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

  const defaultOptions = (navigation: { goBack: () => void }) => ({
    ...getDefaultScreenOptions(theme),
    headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
  });
  const modalOptions = (navigation: { goBack: () => void }) => ({
    ...getModalScreenOptions(theme),
    headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
  });

  return (
    <Stack.Navigator initialRouteName='MainTabs' screenOptions={{ headerShown: false }}>
      {/* Bottom Tab Navigator — no header, inner tab stacks provide their own */}
      <Stack.Screen name='MainTabs' component={TabNavigator} />

      {/* Offer Modals */}
      <Stack.Group
        screenOptions={({ navigation }) => ({ ...modalOptions(navigation), headerShown: true })}
      >
        <Stack.Screen
          name='OfferDetails'
          component={OfferDetailsScreen}
          options={{ title: 'Offer Details' }}
        />
      </Stack.Group>

      {/* Order Screens - Note: OrderDetails moved to OrdersStack (nested in Orders tab) */}
      <Stack.Group
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen name='OrderHistory' options={{ title: 'Order History' }}>
          {props => (
            <ProtectedRoute>
              <OrderHistoryScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

        <Stack.Screen
          name='Checkout'
          options={{ title: 'Checkout', presentation: 'modal' }}
        >
          {props => (
            <ProtectedRoute>
              <CheckoutScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>

      {/* Loyalty Screen */}
      <Stack.Group
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen name='Leaderboard' options={{ title: 'Leaderboard' }}>
          {(props: any) => (
            <ProtectedRoute>
              <LeaderboardScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

        <Stack.Screen name='Loyalty' options={{ title: 'My Points' }}>
          {(props: any) => (
            <ProtectedRoute>
              <LoyaltyScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>

      {/* Profile Sub-screens — slide_from_right to match EditProfile */}
      <Stack.Group
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen name='Settings' options={{ title: 'Settings' }}>
          {props => (
            <ProtectedRoute>
              <SettingsScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

        <Stack.Screen name='Privacy' options={{ title: 'Privacy & Data' }}>
          {props => (
            <ProtectedRoute>
              <PrivacyScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

        <Stack.Screen name='Security' options={{ title: 'Security' }}>
          {props => (
            <ProtectedRoute>
              <SecurityScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>

      {/* Establishment Screens */}
      <Stack.Group
        screenOptions={({ navigation }) => ({ ...defaultOptions(navigation), headerShown: true })}
      >
        <Stack.Screen name='EstablishmentDetails' options={{ title: 'Establishment Details' }}>
          {props => (
            <ProtectedRoute>
              <EstablishmentDetailsScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>

      {/* Map Screens */}
      <Stack.Group
        screenOptions={({ navigation }) => ({ ...modalOptions(navigation), headerShown: true })}
      >
        <Stack.Screen name='NearbyOffers' options={{ title: 'Nearby Offers' }}>
          {props => (
            <ProtectedRoute>
              <NearbyOffersScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>
    </Stack.Navigator>
  );
};
