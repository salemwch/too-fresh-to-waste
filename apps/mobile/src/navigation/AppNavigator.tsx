import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Placeholder component for now
const HomeScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Food Waste App</Text>
    <Text style={styles.subtitle}>Production-ready React Native TypeScript Project</Text>
  </View>
);

const AppNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName='Home'
      screenOptions={{
        headerStyle: {
          backgroundColor: '#3498db',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name='Home'
        component={HomeScreen}
        options={{
          title: 'Food Waste App',
        }}
      />
    </Stack.Navigator>
  </NavigationContainer>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default AppNavigator;
