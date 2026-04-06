/**
 * Order History Screen
 * Display list of all past orders
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';

import { Text, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type OrderHistoryScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OrderHistory'
>;

interface OrderHistoryScreenProps {
  navigation: OrderHistoryScreenNavigationProp;
}

export const OrderHistoryScreen: React.FC<OrderHistoryScreenProps> = ({
  navigation: _navigation,
}) => {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    // TODO: Fetch order history
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Card style={styles.card}>
          <Text variant="headline" size="lg" weight="bold" style={styles.title}>
            Order History
          </Text>

          <View style={styles.emptyState}>
            <Text variant="display" size="xl" style={styles.emptyStateIcon}>
              📜
            </Text>
            <Text variant="body" size="md" align="center" color="secondary">
              Your order history will appear here
            </Text>
            <Text
              variant="body"
              size="sm"
              align="center"
              color="secondary"
              style={styles.emptyStateNote}
            >
              (API integration pending)
            </Text>
          </View>
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
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateNote: {
    marginTop: 8,
  },
});
