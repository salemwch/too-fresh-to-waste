/**
 * Profile Stack Navigator
 * Nested stack inside Profile tab for profile -> edit flow
 * Keeps bottom tab bar visible on both screens
 *
 * Architecture:
 *   ProfileMain (profile view) -> EditProfile (edit view)
 *
 * Headers are now fully provided by this NativeStack (not BottomTab).
 * Uses shared headerConfig for consistent styling.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/design-system/providers';
import { EditProfileScreen } from '@/features/profile/screens/EditProfileScreen';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';

import { getDefaultScreenOptions, makeHeaderBackButton } from './headerConfig';
import { ProtectedRoute } from './ProtectedRoute';

import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * Profile Stack Component
 * Nested navigator for Profile tab
 */
export const ProfileStack: React.FC = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...getDefaultScreenOptions(theme),
        headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
      })}
    >
      {/* Profile Main Screen — NativeStack provides the header */}
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />

      {/* Edit Profile Screen */}
      <Stack.Screen name="EditProfile" options={{ title: 'Edit Profile' }}>
        {(props) => (
          <ProtectedRoute>
            <EditProfileScreen {...props} />
          </ProtectedRoute>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
