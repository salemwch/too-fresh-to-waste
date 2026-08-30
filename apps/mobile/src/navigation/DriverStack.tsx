import React, { createElement, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { logoutAsync } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { AppHeader } from './components/AppHeader';
import DriverActiveOrderScreen from '@/features/driver/screens/DriverActiveOrderScreen';
import DriverEarningsScreen from '@/features/driver/screens/DriverEarningsScreen';
import DriverOrderDetailScreen from '@/features/driver/screens/DriverOrderDetailScreen';
import DriverOrdersListScreen from '@/features/driver/screens/DriverOrdersListScreen';

import type { DriverStackParamList } from './types';

const Stack = createNativeStackNavigator<DriverStackParamList>();

const PRIMARY = colorTokens.base.primary[500];
const { base: sp } = spacingTokens;

function LogoutButton() {
  const { t } = useTranslation();
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
        accessibilityLabel={t('auth.signOut')}
        accessibilityHint={t('auth.a11ySignOutHint')}
        accessibilityRole='button'
      >
        <Text style={styles.logoutText}>{t('auth.signOut')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DriverStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName='DriverOrdersList'
      screenOptions={{
        headerStyle: { backgroundColor: PRIMARY },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        headerRight: () => <LogoutButton />,
        // AppHeader uses useSafeAreaInsets().top (reads via getRootWindowInsets)
        // which always returns the real status-bar height even on OEM builds
        // where WindowInsets are consumed before reaching the native toolbar.
        header: props => createElement(AppHeader, props),
      }}
    >
      <Stack.Screen
        name='DriverOrdersList'
        component={DriverOrdersListScreen}
        options={{ title: t('driver.availableOrders') }}
      />
      <Stack.Screen
        name='DriverOrderDetail'
        component={DriverOrderDetailScreen}
        options={{ title: t('driver.orderDetails') }}
      />
      <Stack.Screen
        name='DriverActiveOrder'
        component={DriverActiveOrderScreen}
        options={{ title: t('driver.activeDelivery') }}
      />
      <Stack.Screen
        name='DriverEarnings'
        component={DriverEarningsScreen}
        options={{ title: t('driver.earnings') }}
      />
    </Stack.Navigator>
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
