/**
 * Main Stack Navigator
 * Handles all authenticated screens and modals
 * Contains the bottom tab navigator and modal screens
 *
 * NOTE: Direct imports used instead of React.lazy() due to Metro bundler
 * incompatibility (facebook/metro#1019). Metro's inlineRequires handles
 * lazy loading at the module level automatically.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/design-system/providers';

// Offer Screens
import { OfferDetailsScreen } from '@/features/offers/screens/OfferDetailsScreen';

// Order Screens
import { OrderDetailsScreen } from '@/features/orders/screens/OrderDetailsScreen';
import { OrderHistoryScreen } from '@/features/orders/screens/OrderHistoryScreen';
import { CheckoutScreen } from '@/features/orders/screens/CheckoutScreen';

// Profile Screens
import { EditProfileScreen } from '@/features/profile/screens/EditProfileScreen';
import { SettingsScreen } from '@/features/profile/screens/SettingsScreen';
import { PrivacyScreen } from '@/features/profile/screens/PrivacyScreen';
import { SecurityScreen } from '@/features/profile/screens/SecurityScreen';

// Establishment Screens
import { EstablishmentDetailsScreen } from '@/features/establishments/screens/EstablishmentDetailsScreen';

// Map Screens
import { NearbyOffersScreen } from '@/features/map/screens/NearbyOffersScreen';

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

  /**
   * Common modal screen options
   */
  const modalScreenOptions = {
    presentation: 'modal' as const,
    headerStyle: {
      backgroundColor: theme.colors.surface,
    },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: {
      fontFamily: theme.typography.fontFamily.primary,
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    headerShadowVisible: true,
    headerStatusBarHeight: 0, // Fix for Android - prevent header from being cut off
  };

  /**
   * Common full screen options
   */
  const screenOptions = {
    headerStyle: {
      backgroundColor: theme.colors.surface,
    },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: {
      fontFamily: theme.typography.fontFamily.primary,
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    headerShadowVisible: false,
    animation: 'slide_from_right' as const,
  };

  return (
    <Stack.Navigator initialRouteName='MainTabs' screenOptions={{ headerShown: true }}>
      {/* Bottom Tab Navigator */}
      <Stack.Screen name='MainTabs' component={TabNavigator} options={{ headerShown: false }} />

      {/* Offer Modals */}
      <Stack.Group screenOptions={modalScreenOptions}>
        <Stack.Screen
          name='OfferDetails'
          component={OfferDetailsScreen}
          options={{ title: 'Offer Details' }}
        />
      </Stack.Group>

      {/* Order Screens */}
      <Stack.Group screenOptions={screenOptions}>
        <Stack.Screen name='OrderDetails' options={{ title: 'Order Details' }}>
          {props => (
            <ProtectedRoute>
              <OrderDetailsScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

        <Stack.Screen name='OrderHistory' options={{ title: 'Order History' }}>
          {props => (
            <ProtectedRoute>
              <OrderHistoryScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

        <Stack.Screen name='Checkout' options={{ title: 'Checkout', presentation: 'modal' }}>
          {props => (
            <ProtectedRoute>
              <CheckoutScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>

      {/* Profile Modals */}
      <Stack.Group screenOptions={modalScreenOptions}>
        <Stack.Screen name='EditProfile' options={{ title: 'Edit Profile' }}>
          {props => (
            <ProtectedRoute>
              <EditProfileScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>

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
      <Stack.Group screenOptions={screenOptions}>
        <Stack.Screen name='EstablishmentDetails' options={{ title: 'Establishment Details' }}>
          {props => (
            <ProtectedRoute>
              <EstablishmentDetailsScreen {...props} />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Group>

      {/* Map Screens */}
      <Stack.Group screenOptions={modalScreenOptions}>
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
