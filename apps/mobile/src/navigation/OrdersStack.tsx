/**
 * Orders Stack Navigator
 * Nested stack inside Orders tab for list -> detail flow
 * Keeps bottom tab bar visible on both screens
 *
 * Architecture:
 *   OrdersList (list view) -> OrderDetails (detail view)
 *
 * Headers are now fully provided by this NativeStack (not BottomTab).
 * Uses shared headerConfig for consistent styling.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/design-system/providers';
import { OrderDetailsScreen } from '@/features/orders/screens/OrderDetailsScreen';
import { OrdersScreen } from '@/features/orders/screens/OrdersScreen';

import { getDefaultScreenOptions, makeHeaderBackButton } from './headerConfig';
import { ProtectedRoute } from './ProtectedRoute';

import type { OrdersStackParamList } from './types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

/**
 * Orders Stack Component
 * Nested navigator for Orders tab
 */
export const OrdersStack: React.FC = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...getDefaultScreenOptions(theme),
        headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
      })}
    >
      {/* Orders List Screen — NativeStack provides the header */}
      <Stack.Screen
        name='OrdersList'
        component={OrdersScreen}
        options={{ title: 'My Orders' }}
      />

      {/* Order Details Screen */}
      <Stack.Screen name='OrderDetails' options={{ title: 'Order Details' }}>
        {props => (
          <ProtectedRoute>
            <OrderDetailsScreen {...props} />
          </ProtectedRoute>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
