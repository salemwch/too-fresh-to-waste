/**
 * Tab Navigator
 * Bottom tab navigation for main app screens
 * Home, Search, Favorites, Orders, Profile
 *
 * Headers are rendered by each tab's NativeStack navigator,
 * NOT by the BottomTab itself (headerShown: false).
 * This ensures consistent native header height and animation
 * across all screens.
 *
 * NOTE: Direct imports used instead of React.lazy() due to Metro bundler
 * incompatibility (facebook/metro#1019). Metro's inlineRequires handles
 * lazy loading at the module level automatically.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { memo } from 'react';
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
  const insets = useSafeAreaInsets();

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
        // Headers are provided by each tab's NativeStack — disable BottomTab headers
        headerShown: false,

        // Lazy mount screens (only render when first accessed)
        lazy: true,

        // Tab Bar Icon
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = getTabIcon(route.name, focused);
          return <Icon name={iconName} family='Ionicons' size={size} color={color} />;
        },

        // Tab Bar Styling
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
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: theme.colors.surface }} />
        ),
       
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.secondary,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight?.medium ?? '500',
        },

        // Behavior
        tabBarHideOnKeyboard: true,
      })}
    >
      {/* Home Tab */}
      <Tab.Screen
        name='Home'
        component={HomeStack}
        listeners={{
          tabPress: (_e) => {
            if (__DEV__) console.log('[TabNavigator] Home tab pressed');
          },
        }}
        options={{ title: 'Home' }}
      />

      {/* Search Tab */}
      <Tab.Screen
        name='Search'
        component={SearchStack}
        listeners={{
          tabPress: (_e) => {
            if (__DEV__) console.log('[TabNavigator] Search tab pressed');
          },
        }}
        options={{ title: 'Search' }}
      />

      {/* Favorites Tab */}
      <Tab.Screen
        name='Favorites'
        component={FavoritesStack}
        listeners={{
          tabPress: (_e) => {
            if (__DEV__) console.log('[TabNavigator] Favorites tab pressed');
          },
        }}
        options={{ title: 'Favorites' }}
      />

      {/* Orders Tab */}
      <Tab.Screen
        name='Orders'
        component={OrdersStack}
        options={{ title: 'Orders' }}
      />

      {/* Profile Tab — reset nested stack to ProfileMain whenever the tab is pressed */}
      <Tab.Screen
        name='Profile'
        component={ProfileStack}
        options={{ title: 'Profile' }}
        listeners={({ navigation }) => ({
          tabPress: (_e) => {
            const state = navigation.getState();
            const profileIndex = state.routes.findIndex(r => r.name === 'Profile');
            const isProfileActive = state.index === profileIndex;
            const profileStackDepth = (state.routes[profileIndex]?.state?.index ?? 0) as number;

            // Already on ProfileMain — nothing to do.
            if (isProfileActive && profileStackDepth === 0) return;

            // Deep in stack or switching from another tab: pop ProfileStack to root.
            // navigate() pops to ProfileMain if it already exists in the stack.
            _e.preventDefault();
            (navigation as any).navigate('Profile', { screen: 'ProfileMain' });
          },
        })}
      />
    </Tab.Navigator>
  );
};

/**
 * PRODUCTION: Memoize TabNavigator to prevent unnecessary re-renders
 * TabNavigator only needs to re-render when theme changes
 */
export const TabNavigator = memo(TabNavigatorComponent);
