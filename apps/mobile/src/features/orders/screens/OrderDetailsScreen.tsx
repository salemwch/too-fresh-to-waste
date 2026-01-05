/**
 * Order Details Screen
 * Display full details of a specific order
 *
 * Features:
 * - Shows post-purchase donation impact animation (ImpactMoment)
 * - Displays order details and status
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card, Badge } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { ImpactMoment, useDonationStats } from '@/features/donations';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type OrderDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OrderDetails'
>;

type OrderDetailsScreenRouteProp = RouteProp<MainStackParamList, 'OrderDetails'>;

interface OrderDetailsScreenProps {
  navigation: OrderDetailsScreenNavigationProp;
  route: OrderDetailsScreenRouteProp;
}

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { orderId } = route.params;

  // Donation impact state
  const [showImpactMoment, setShowImpactMoment] = useState(true);
  const { data: donationStats } = useDonationStats();

  // TODO: Replace with real order data from API
  // For now, using mock data to demonstrate UX flow
  const mockOrder = {
    id: orderId,
    total: 25.5, // TND
    donationAmount: 0.26, // 1% of total (25.5 * 0.01)
    status: 'confirmed',
    createdAt: new Date(),
  };

  // Show impact moment only once when screen first loads
  useEffect(() => {
    // Reset impact moment visibility when order changes
    setShowImpactMoment(true);
  }, [orderId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text variant='headline' size='lg' weight='bold'>
              Order Details
            </Text>
            <Badge label='Pending' variant='warning' size='md' />
          </View>

          <Text variant='body' size='md' color='secondary' style={styles.subtitle}>
            Order ID: {orderId}
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              📦 Order details will be displayed here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={{ marginTop: 8 }}
            >
              Status, Items, Pickup Time, QR Code, etc.
            </Text>
          </View>

          <Button variant='primary' size='lg' onPress={() => {}} style={styles.button}>
            Show QR Code
          </Button>

          <Button
            variant='outline'
            size='md'
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Go Back
          </Button>
        </Card>
      </ScrollView>

      {/* 🎉 Donation Impact Moment - Shows after order confirmation */}
      {mockOrder.donationAmount > 0 && donationStats && (
        <ImpactMoment
          visible={showImpactMoment}
          donationAmount={mockOrder.donationAmount}
          totalDonations={donationStats.totalDonations}
          mealCount={donationStats.mealCount}
          onDismiss={() => setShowImpactMoment(false)}
          currency='TND'
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
  },
  placeholder: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  button: {
    marginTop: 12,
  },
});
