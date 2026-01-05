/**
 * Offer Details Screen
 * Display full details of a specific offer
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type OfferDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OfferDetails'
>;

type OfferDetailsScreenRouteProp = RouteProp<MainStackParamList, 'OfferDetails'>;

interface OfferDetailsScreenProps {
  navigation: OfferDetailsScreenNavigationProp;
  route: OfferDetailsScreenRouteProp;
}

export const OfferDetailsScreen: React.FC<OfferDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { offerId } = route.params;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            Offer Details
          </Text>
          <Text variant='body' size='md' color='secondary' style={styles.subtitle}>
            Offer ID: {offerId}
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              🍕 Offer details will be displayed here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={{ marginTop: 8 }}
            >
              (API integration pending)
            </Text>
          </View>

          <Button
            variant='primary'
            size='lg'
            onPress={() => navigation.navigate('Checkout', { offerId })}
            style={styles.button}
          >
            Reserve This Offer
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
    paddingVertical: 60,
    alignItems: 'center',
  },
  button: {
    marginTop: 12,
  },
});
