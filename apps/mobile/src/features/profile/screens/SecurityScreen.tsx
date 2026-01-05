/**
 * Security Screen
 * Security settings and authentication options
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SecurityScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Security'>;

interface SecurityScreenProps {
  navigation: SecurityScreenNavigationProp;
}

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation: _navigation }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            Security
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              🛡️ Security settings will be here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={{ marginTop: 8 }}
            >
              Change password, Enable 2FA, Active sessions, Login history
            </Text>
          </View>

          <Card style={styles.actionCard}>
            <Text variant='title' size='md' weight='semibold' style={{ marginBottom: 12 }}>
              Quick Actions
            </Text>
            <Button variant='outline' size='md' onPress={() => {}} style={styles.button}>
              Change Password
            </Button>
            <Button variant='outline' size='md' onPress={() => {}} style={styles.button}>
              Enable Two-Factor Authentication
            </Button>
            <Button variant='outline' size='md' onPress={() => {}} style={styles.button}>
              View Active Sessions
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
  actionCard: {
    padding: 16,
  },
  button: {
    marginTop: 12,
  },
});
