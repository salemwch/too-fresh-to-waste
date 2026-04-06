/**
 * Privacy Screen
 * Privacy settings and data management
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { deleteAccountAsync } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { showAlert } from '@/utils/alert';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type PrivacyScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Privacy'>;

const DANGER_BORDER = '#ffebee';

interface PrivacyScreenProps {
  navigation: PrivacyScreenNavigationProp;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(state => state.auth.isLoading);

  const handleDeleteAccount = useCallback(() => {
    showAlert(
      'Delete Account?',
      'This action is permanent and cannot be undone. All your data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void dispatch(deleteAccountAsync());
          },
        },
      ],
      { type: 'error' },
    );
  }, [dispatch]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            Privacy & Data
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              Privacy settings will be here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={styles.placeholderNote}
            >
              Data sharing, Analytics, Location, Download data, Delete account
            </Text>
          </View>

          <Card style={styles.dangerZone}>
            <Text variant='title' size='md' weight='semibold' style={styles.dangerTitle}>
              Danger Zone
            </Text>
            <Button
              variant='outline'
              size='md'
              onPress={() => {}}
              style={[styles.button, { borderColor: theme.colors.error }]}
              textStyle={{ color: theme.colors.error }}
            >
              Download My Data
            </Button>
            <Button
              variant='outline'
              size='md'
              onPress={handleDeleteAccount}
              loading={isLoading}
              style={[styles.button, { borderColor: theme.colors.error }]}
              textStyle={{ color: theme.colors.error }}
            >
              Delete Account
            </Button>
          </Card>
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
    marginBottom: 24,
  },
  placeholder: {
    paddingVertical: 60,
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderNote: {
    marginTop: 8,
  },
  dangerZone: {
    padding: 16,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
  },
  dangerTitle: {
    marginBottom: 12,
  },
  button: {
    marginTop: 12,
  },
});
