import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import DriverActiveOrderScreen from '@/features/driver/screens/DriverActiveOrderScreen';
import DriverOrderDetailScreen from '@/features/driver/screens/DriverOrderDetailScreen';
import DriverOrdersListScreen from '@/features/driver/screens/DriverOrdersListScreen';

import type { DriverStackParamList } from './types';

const Stack = createNativeStackNavigator<DriverStackParamList>();

export default function DriverStack() {
  return (
    <Stack.Navigator initialRouteName='DriverOrdersList'>
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
  );
}
