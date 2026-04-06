/**
 * Search Stack Navigator
 * Wraps SearchScreen in a NativeStack for consistent native headers.
 *
 * Architecture:
 *   BottomTab (headerShown: false) → SearchStack (NativeStack) → SearchScreen
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/design-system/providers';
import { SearchScreen } from '@/features/search/screens/SearchScreen';

import { getDefaultScreenOptions, makeHeaderBackButton } from './headerConfig';

import type { SearchStackParamList } from './types';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export const SearchStack: React.FC = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...getDefaultScreenOptions(theme),
        headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
      })}
    >
      <Stack.Screen
        name="SearchMain"
        component={SearchScreen}
        options={{ title: 'Search Offers' }}
      />
    </Stack.Navigator>
  );
};
