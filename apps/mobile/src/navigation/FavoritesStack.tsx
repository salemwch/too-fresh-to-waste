/**
 * Favorites Stack Navigator
 * Wraps FavoritesScreen in a NativeStack for consistent native headers.
 *
 * Architecture:
 *   BottomTab (headerShown: false) → FavoritesStack (NativeStack) → FavoritesScreen
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/design-system/providers';
import { FavoritesScreen } from '@/features/favorites/screens/FavoritesScreen';

import { getDefaultScreenOptions, makeHeaderBackButton } from './headerConfig';

import type { FavoritesStackParamList } from './types';

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

export const FavoritesStack: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...getDefaultScreenOptions(theme),
        headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
      })}
    >
      <Stack.Screen
        name='FavoritesMain'
        component={FavoritesScreen}
        options={{ title: t('navigation.myFavorites') }}
      />
    </Stack.Navigator>
  );
};
