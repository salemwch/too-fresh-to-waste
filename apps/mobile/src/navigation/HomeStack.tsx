/**
 * Home Stack Navigator
 * Wraps HomeScreen in a NativeStack so it gets a native header
 * instead of a JS-based header from BottomTab.
 *
 * Architecture:
 *   BottomTab (headerShown: false) → HomeStack (NativeStack) → HomeScreen
 *
 * The HomeScreen's useLayoutEffect + setOptions() overrides the header
 * at runtime to inject LocationHeader and action icons. This works
 * identically on NativeStack as it did on BottomTab.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/design-system/providers';
import { HomeScreen } from '@/features/home/screens/HomeScreen';

import { LocationHeader } from './components';
import { getDefaultScreenOptions } from './headerConfig';

import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStack: React.FC = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator screenOptions={getDefaultScreenOptions(theme)}>
      <Stack.Screen
        name='HomeMain'
        component={HomeScreen}
        options={{
          headerTitle: () => <LocationHeader />,
          headerTitleAlign: 'left',
        }}
      />
    </Stack.Navigator>
  );
};
