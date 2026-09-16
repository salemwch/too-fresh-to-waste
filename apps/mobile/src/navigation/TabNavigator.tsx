/**
 * Tab Navigator
 * Bottom tab navigation for main app screens.
 * Home, Search, Favorites, Orders, Profile.
 *
 * Headers are rendered by each tab's NativeStack navigator,
 * not by the BottomTab itself (headerShown: false).
 * This ensures consistent native header height and animation
 * across all screens.
 *
 * The bar itself is `FloatingTabBar`, a custom `tabBar` component. Icons,
 * labels, colours and height are all decided there rather than through
 * `screenOptions` - react-navigation's own bar clips its children, and this
 * design needs the circles to overflow the bar's bounds. The only option this
 * navigator still feeds the bar is `title`, which it uses as each tab's
 * accessibility label.
 *
 * NOTE: Direct imports are used instead of React.lazy() due to Metro bundler
 * incompatibility (facebook/metro#1019). Metro's inlineRequires handles
 * lazy loading at the module level automatically.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { FavoritesStack } from './FavoritesStack';
import { HomeStack } from './HomeStack';
import { OrdersStack } from './OrdersStack';
import { ProfileStack } from './ProfileStack';
import { SearchStack } from './SearchStack';
import { FloatingTabBar } from './components/FloatingTabBar';

import type { TabParamList } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Tab Navigator Component
 * Main bottom tab navigation for authenticated users
 *
 * PRODUCTION OPTIMIZATIONS:
 * - Lazy loading of tab screens (only render when first accessed)
 * - Custom tab bar memoised, so it re-renders only on navigation state change
 */
const TabNavigatorComponent: React.FC = () => {
  const { t } = useTranslation();

  /*
   * Stable identity. An inline arrow here would hand react-navigation a new
   * component type on every render, which remounts the whole bar - losing the
   * keyboard listener and re-running its effects on each navigation.
   */
  const renderTabBar = useCallback((props: BottomTabBarProps) => <FloatingTabBar {...props} />, []);

  return (
    <Tab.Navigator
      initialRouteName='Home'
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name='Home' component={HomeStack} options={{ title: t('tabs.home') }} />
      <Tab.Screen name='Search' component={SearchStack} options={{ title: t('tabs.search') }} />
      <Tab.Screen
        name='Favorites'
        component={FavoritesStack}
        options={{ title: t('tabs.favorites') }}
      />
      <Tab.Screen name='Orders' component={OrdersStack} options={{ title: t('tabs.orders') }} />

      {/* Reset ProfileStack to ProfileMain whenever the Profile tab is pressed. */}
      <Tab.Screen
        name='Profile'
        component={ProfileStack}
        options={{ title: t('tabs.profile') }}
        listeners={({ navigation }) => ({
          tabPress: event => {
            const state = navigation.getState();
            const profileIndex = state.routes.findIndex(route => route.name === 'Profile');

            if (profileIndex < 0) {
              return;
            }

            const profileRoute = state.routes[profileIndex];
            if (profileRoute === undefined) return;
            const isProfileActive = state.index === profileIndex;
            const profileStackDepth = profileRoute.state?.index ?? 0;

            if (isProfileActive && profileStackDepth === 0) {
              return;
            }

            event.preventDefault();

            const profileStateKey =
              profileRoute.state && 'key' in profileRoute.state
                ? profileRoute.state.key
                : undefined;

            if (typeof profileStateKey === 'string') {
              navigation.dispatch({
                ...StackActions.popToTop(),
                target: profileStateKey,
              });
            }

            navigation.navigate('Profile');
          },
        })}
      />
    </Tab.Navigator>
  );
};

/**
 * Memoize TabNavigator to prevent unnecessary re-renders.
 * TabNavigator only needs to re-render when the theme changes.
 */
export const TabNavigator = memo(TabNavigatorComponent);
