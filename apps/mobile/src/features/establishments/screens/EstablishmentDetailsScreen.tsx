/**
 * Establishment Details Screen
 * Display full details of a specific establishment
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card, Badge } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type EstablishmentDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'EstablishmentDetails'
>;

type EstablishmentDetailsScreenRouteProp = RouteProp<MainStackParamList, 'EstablishmentDetails'>;

interface EstablishmentDetailsScreenProps {
  navigation: EstablishmentDetailsScreenNavigationProp;
  route: EstablishmentDetailsScreenRouteProp;
}

export const EstablishmentDetailsScreen: React.FC<EstablishmentDetailsScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { establishmentId } = route.params;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text variant='headline' size='lg' weight='bold'>
              Establishment Details
            </Text>
            <Badge label={t('common.open')} variant='success' size='md' />
          </View>

          <Text variant='body' size='md' color='secondary' style={styles.subtitle}>
            ID: {establishmentId}
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              🏪 Establishment details will be displayed here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={styles.placeholderSubtitle}
            >
              Name, Address, Hours, Photos, Available Offers, Reviews
            </Text>
          </View>

          <Button variant='primary' size='lg' onPress={() => {}} style={styles.button}>
            View Available Offers
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
  placeholderSubtitle: {
    marginTop: 8,
  },
  button: {
    marginTop: 12,
  },
});
