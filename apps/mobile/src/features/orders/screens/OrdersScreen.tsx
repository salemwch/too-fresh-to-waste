/**
 * Orders Screen
 * Display user's order history and active orders
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';

import { Text, Button, Card, Badge, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppSelector } from '@/hooks/redux';

import type { OrdersScreenNavigationProp } from '@/navigation/types';

interface OrdersScreenProps {
  navigation: OrdersScreenNavigationProp;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { user } = useAppSelector(state => state.auth);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'active' | 'history'>('active');
  const [hasOrders] = useState(false);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch user's orders
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  /**
   * Navigate to browse offers
   */
  const handleBrowseOffers = useCallback(() => {
    navigation.jumpTo('Home');
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Button
          variant={selectedTab === 'active' ? 'primary' : 'ghost'}
          size='md'
          onPress={() => setSelectedTab('active')}
          style={styles.tabButton}
          accessibilityRole='tab'
          accessibilityLabel='Active orders'
          accessibilityHint='View your active orders'
          accessibilityState={{ selected: selectedTab === 'active' }}
        >
          Active Orders
        </Button>
        <Button
          variant={selectedTab === 'history' ? 'primary' : 'ghost'}
          size='md'
          onPress={() => setSelectedTab('history')}
          style={styles.tabButton}
          accessibilityRole='tab'
          accessibilityLabel='Order history'
          accessibilityHint='View your completed orders'
          accessibilityState={{ selected: selectedTab === 'history' }}
        >
          History
        </Button>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel='Orders content'
        accessibilityHint='Scroll to view your orders'
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            accessibilityLabel={refreshing ? 'Refreshing orders' : 'Pull to refresh'}
          />
        }
      >
        {/* Empty State */}
        {!hasOrders && (
          <View style={styles.emptyState}>
            <View
              style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceContainer }]}
            >
              <Icon
                name={selectedTab === 'active' ? 'receipt-outline' : 'time-outline'}
                family='Ionicons'
                size={64}
                color={theme.colors.onSurfaceVariant}
              />
            </View>

            <Text variant='headline' size='lg' weight='semibold' align='center'>
              {selectedTab === 'active' ? 'No Active Orders' : 'No Order History'}
            </Text>

            <Text
              variant='body'
              size='md'
              color='secondary'
              align='center'
              style={styles.emptyStateDescription}
            >
              {selectedTab === 'active'
                ? 'Start saving food and money by placing your first order'
                : "You haven't completed any orders yet"}
            </Text>

            <Button
              variant='primary'
              size='lg'
              onPress={handleBrowseOffers}
              leftIcon='restaurant-outline'
              leftIconFamily='Ionicons'
              style={styles.browseButton}
              accessibilityLabel='Browse offers'
              accessibilityHint='Navigate to home screen to discover food offers'
            >
              Browse Offers
            </Button>

            {/* Info Card */}
            <Card style={styles.infoCard}>
              <Text variant='title' size='sm' weight='semibold' style={styles.infoTitle}>
                How It Works
              </Text>
              <View style={styles.stepsContainer}>
                <View style={styles.stepItem}>
                  <View
                    style={[styles.stepNumber, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Text
                      variant='body'
                      size='sm'
                      weight='bold'
                      style={{ color: theme.colors.primary }}
                    >
                      1
                    </Text>
                  </View>
                  <Text variant='body' size='sm' color='secondary'>
                    Browse and select an offer
                  </Text>
                </View>
                <View style={styles.stepItem}>
                  <View
                    style={[styles.stepNumber, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Text
                      variant='body'
                      size='sm'
                      weight='bold'
                      style={{ color: theme.colors.primary }}
                    >
                      2
                    </Text>
                  </View>
                  <Text variant='body' size='sm' color='secondary'>
                    Complete payment
                  </Text>
                </View>
                <View style={styles.stepItem}>
                  <View
                    style={[styles.stepNumber, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Text
                      variant='body'
                      size='sm'
                      weight='bold'
                      style={{ color: theme.colors.primary }}
                    >
                      3
                    </Text>
                  </View>
                  <Text variant='body' size='sm' color='secondary'>
                    Pick up during specified time
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Orders List Placeholder */}
        {hasOrders && (
          <View style={styles.ordersSection}>
            <View style={styles.header}>
              <Text variant='title' size='md' weight='medium'>
                {selectedTab === 'active' ? 'Active Orders' : 'Order History'}
              </Text>
              <Badge label='0' variant='neutral' size='sm' />
            </View>

            <Card style={styles.placeholderCard}>
              <Text variant='body' size='md' color='secondary' align='center'>
                {selectedTab === 'active' ? 'No active orders' : 'No order history'}
              </Text>
              <Text
                variant='body'
                size='sm'
                color='secondary'
                align='center'
                style={styles.placeholderSubtext}
              >
                {selectedTab === 'active'
                  ? 'Your active orders will appear here'
                  : 'Your completed orders will appear here'}
              </Text>
            </Card>
          </View>
        )}

        {/* Merchant View - Show Different Content */}
        {user?.role === 'merchant' && hasOrders && (
          <View style={styles.merchantSection}>
            <Card style={styles.statsCard}>
              <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
                Order Statistics
              </Text>
              <View style={styles.statsGrid}>
                <View
                  style={styles.statItem}
                  accessibilityLabel='Pending orders: 0'
                  accessibilityHint='Number of pending orders waiting to be fulfilled'
                >
                  <Text variant='headline' size='lg' weight='bold' color='primary'>
                    0
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    Pending
                  </Text>
                </View>
                <View
                  style={styles.statItem}
                  accessibilityLabel='Completed orders: 0'
                  accessibilityHint='Number of successfully completed orders'
                >
                  <Text variant='headline' size='lg' weight='bold' color='success'>
                    0
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    Completed
                  </Text>
                </View>
                <View
                  style={styles.statItem}
                  accessibilityLabel='Revenue: $0'
                  accessibilityHint='Total revenue from completed orders'
                >
                  <Text variant='headline' size='lg' weight='bold' color='warning'>
                    $0
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    Revenue
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  tabButton: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  iconContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateDescription: {
    marginTop: 12,
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  browseButton: {
    minWidth: 200,
    marginBottom: 32,
  },
  infoCard: {
    padding: 20,
    width: '100%',
  },
  infoTitle: {
    marginBottom: 16,
  },
  stepsContainer: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ordersSection: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderCard: {
    padding: 48,
    alignItems: 'center',
  },
  placeholderSubtext: {
    marginTop: 8,
  },
  merchantSection: {
    marginTop: 16,
  },
  statsCard: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
});
