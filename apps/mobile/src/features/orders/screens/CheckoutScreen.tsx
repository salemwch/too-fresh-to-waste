/**
 * Checkout Screen
 * Finalize order and payment
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CheckoutScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Checkout'>;

type CheckoutScreenRouteProp = RouteProp<MainStackParamList, 'Checkout'>;

interface CheckoutScreenProps {
  navigation: CheckoutScreenNavigationProp;
  route: CheckoutScreenRouteProp;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { offerId } = route.params;

  const handleConfirmOrder = () => {
    // TODO: Implement order creation logic
    console.log('Confirm order for offer:', offerId);
    // Navigate to order details after creation
    navigation.navigate('OrderDetails', { orderId: 'mock-order-id' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            Checkout
          </Text>
          <Text variant='body' size='md' color='secondary' style={styles.subtitle}>
            Offer ID: {offerId}
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              💳 Checkout form will be here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={{ marginTop: 8 }}
            >
              Order summary, Payment method, Pickup time selection
            </Text>
          </View>

          <Card style={styles.summaryCard}>
            <Text variant='title' size='md' weight='semibold' style={{ marginBottom: 12 }}>
              Order Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text variant='body' size='md'>
                Subtotal
              </Text>
              <Text variant='body' size='md' weight='semibold'>
                $0.00
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant='body' size='md'>
                Service Fee
              </Text>
              <Text variant='body' size='md' weight='semibold'>
                $0.00
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text variant='title' size='md' weight='bold'>
                Total
              </Text>
              <Text variant='title' size='md' weight='bold' color='primary'>
                $0.00
              </Text>
            </View>
          </Card>

          <Button variant='primary' size='lg' onPress={handleConfirmOrder} style={styles.button}>
            Confirm Order
          </Button>

          <Button
            variant='outline'
            size='md'
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Cancel
          </Button>
        </Card>
      </ScrollView>
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
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
  },
  placeholder: {
    paddingVertical: 40,
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 12,
  },
  button: {
    marginTop: 12,
  },
});
