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
 * NOTE: Direct imports are used instead of React.lazy() due to Metro bundler
 * incompatibility (facebook/metro#1019). Metro's inlineRequires handles
 * lazy loading at the module level automatically.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { FavoritesStack } from './FavoritesStack';
import { HomeStack } from './HomeStack';
import { OrdersStack } from './OrdersStack';
import { ProfileStack } from './ProfileStack';
import { SearchStack } from './SearchStack';

import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Tab Navigator Component
 * Main bottom tab navigation for authenticated users
 *
 * PRODUCTION OPTIMIZATIONS:
 * - Lazy loading of tab screens (only render when first accessed)
 * - Memoized icon rendering to prevent re-renders
 * - Optimized tab bar style to reduce layout calculations
 */
const TabNavigatorComponent: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarBackgroundStyle = {
    flex: 1,
    backgroundColor: theme.colors.surface,
  };

  /**
   * Get icon name based on tab and focus state
   */
  const getTabIcon = (routeName: keyof TabParamList, focused: boolean): string => {
    const iconMap: Record<keyof TabParamList, { focused: string; unfocused: string }> = {
      Home: { focused: 'home', unfocused: 'home-outline' },
      Search: { focused: 'search', unfocused: 'search-outline' },
      Favorites: { focused: 'heart', unfocused: 'heart-outline' },
      Orders: { focused: 'receipt', unfocused: 'receipt-outline' },
      Profile: { focused: 'person', unfocused: 'person-outline' },
    };

    return focused
      ? (iconMap[routeName]?.focused ?? 'home')
      : (iconMap[routeName]?.unfocused ?? 'home-outline');
  };

  return (
    <Tab.Navigator
      initialRouteName='Home'
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: true,
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = getTabIcon(route.name, focused);
          return <Icon name={iconName} family='Ionicons' size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 0,
          // Height expands to cover the Android navigation bar inset so the
          // tab bar background fills the full bottom edge in edge-to-edge mode.
          height: Platform.OS === 'ios' ? 88 : 56 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarBackground: () => <View style={tabBarBackgroundStyle} />,
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.secondary,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight?.medium ?? '500',
        },
        tabBarHideOnKeyboard: true,
      })}
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
