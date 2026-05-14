import React, { useCallback } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { logoutAsync } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

import DriverActiveOrderScreen from '@/features/driver/screens/DriverActiveOrderScreen';
import DriverOrderDetailScreen from '@/features/driver/screens/DriverOrderDetailScreen';
import DriverOrdersListScreen from '@/features/driver/screens/DriverOrdersListScreen';

import type { DriverStackParamList } from './types';

const Stack = createNativeStackNavigator<DriverStackParamList>();

const PRIMARY = colorTokens.base.primary[500];
const { base: sp } = spacingTokens;

function LogoutButton() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void dispatch(logoutAsync({ reason: 'user_action' }));
        },
      },
    ]);
  }, [dispatch]);

  return (
    <View style={styles.headerRight}>
      {user ? (
        <Text style={styles.driverName} numberOfLines={1}>
          {user.firstName} {user.lastName}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={handleLogout}
        style={styles.logoutBtn}
        accessibilityLabel='Sign out'
        accessibilityRole='button'
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DriverStack() {
  return (
    <>
      {/* App.tsx sets translucent globally; tell the native stack so it insets
          header content below the status bar instead of colliding with it */}
      <StatusBar barStyle='light-content' backgroundColor={PRIMARY} translucent />
      <Stack.Navigator
        initialRouteName='DriverOrdersList'
        screenOptions={{
          headerStyle: { backgroundColor: PRIMARY },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerRight: () => <LogoutButton />,
          statusBarTranslucent: true,
          statusBarStyle: 'light',
        }}
      >
        <Stack.Screen
          name='DriverOrdersList'
          component={DriverOrdersListScreen}
          options={{ title: 'Available Orders' }}
        />
        <Stack.Screen
          name='DriverOrderDetail'
          component={DriverOrderDetailScreen}
          options={{ title: 'Order Details' }}
        />
        <Stack.Screen
          name='DriverActiveOrder'
          component={DriverActiveOrderScreen}
          options={{ title: 'Active Delivery' }}
        />
      </Stack.Navigator>
    </>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginEnd: sp.xs,
  },
  driverName: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    maxWidth: 100,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
