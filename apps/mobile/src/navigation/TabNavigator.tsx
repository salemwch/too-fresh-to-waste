/**
 * Tab Navigator
 * Bottom tab navigation for main app screens
 * Home, Search, Favorites, Orders, Profile
 *
 * NOTE: Direct imports used instead of React.lazy() due to Metro bundler
 * incompatibility (facebook/metro#1019). Metro's inlineRequires handles
 * lazy loading at the module level automatically.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, View, TouchableOpacity, StyleSheet } from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { SearchScreen } from '@/features/search/screens/SearchScreen';
import { FavoritesScreen } from '@/features/favorites/screens/FavoritesScreen';
import { OrdersScreen } from '@/features/orders/screens/OrdersScreen';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { useLocation } from '@/hooks/useLocation';

import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Location Header Component
 * Custom header showing current location with dropdown
 */
const LocationHeader: React.FC = () => {
  const theme = useTheme();
  const { manualLocationName, hasLocation } = useLocation();

  const handleLocationPress = () => {
    // TODO: Open location selection modal
    console.log('Open location selector');
  };

  return (
    <TouchableOpacity
      style={styles.locationHeader}
      onPress={handleLocationPress}
      accessibilityRole='button'
      accessibilityLabel='Choose location'
      accessibilityHint='Tap to select your location'
    >
      <View style={styles.locationIconCircle}>
        <Icon name='location' family='Ionicons' size={16} color='#FFFFFF' />
      </View>
      <View style={styles.locationTextContainer}>
        <Text variant='body' size='sm' style={styles.locationLabel}>
          Choose Location
        </Text>
        <Text
          variant='body'
          size='md'
          weight='semibold'
          numberOfLines={1}
          ellipsizeMode='tail'
          style={styles.locationValue}
        >
          {hasLocation && manualLocationName
            ? manualLocationName.length > 20
              ? manualLocationName.substring(0, 17).replace(/\s+/g, '_') + '...'
              : manualLocationName
            : 'Choose location...'}
        </Text>
      </View>
      <Icon name='chevron-down' family='Ionicons' size={20} color={theme.colors.onSurface} />
    </TouchableOpacity>
  );
};
/**
 * Tab Navigator Component
 * Main bottom tab navigation for authenticated users
 */
export const TabNavigator: React.FC = () => {
  const theme = useTheme();

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
          borderTopColor: theme.colors.outline,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.secondary,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.medium,
        },

        // Header Styling
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outline,
        },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily.primary,
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold,
        },

        // Behavior
        tabBarHideOnKeyboard: true,
      })}
    >
      {/* Home Tab */}
      <Tab.Screen
        name='Home'
        component={HomeScreen}
        options={{
          title: 'Home',
          headerTitle: () => <LocationHeader />,
        }}
      />

      {/* Search Tab */}
      <Tab.Screen
        name='Search'
        component={SearchScreen}
        options={{
          title: 'Search',
          headerTitle: 'Search Offers',
        }}
      />

      {/* Favorites Tab */}
      <Tab.Screen
        name='Favorites'
        component={FavoritesScreen}
        options={{
          title: 'Favorites',
          headerTitle: 'My Favorites',
        }}
      />

      {/* Orders Tab */}
      <Tab.Screen
        name='Orders'
        component={OrdersScreen}
        options={{
          title: 'Orders',
          headerTitle: 'My Orders',
        }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name='Profile'
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#69dab5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 4,
  },
  locationLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 14,
  },
  locationValue: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 18,
  },
});
