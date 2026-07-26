/**
 * Orders Screen
 * Displays the authenticated consumer's orders in two tabs: Active / History.
 *
 * Data flow:
 *   useOrders → ordersService.getMyOrdersCursor → FlashList<OrderCard>
 *
 * Design spec: apps/check.md
 *   - Pill-style segmented control with count badge
 *   - OrderCard with absolute status badge, strikethrough price, "Go now!" pulse
 *   - Skeleton loading state
 *   - Contextual empty states per tab
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  RefreshControl,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';

import { Text, Icon, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';

import { OrderCard } from '../components/OrderCard';
import { SkeletonOrderCard } from '../components/SkeletonOrderCard';
import { useOrders, usePrefetchOrder } from '../hooks/useOrders';

import type { Order } from '../types/order.types';
import type { OrdersScreenNavigationProp } from '@/navigation/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'active' | 'history';

interface OrdersScreenProps {
  navigation: OrdersScreenNavigationProp;
}

const TAB_BORDER = '#F1F5F9';
const BRAND_PRIMARY = colorTokens.base.primary[500];
const TEXT_SECONDARY = '#64748B';
const WHITE = '#FFFFFF';
const BADGE_BACKGROUND = '#E2E8F0';
const BADGE_ACTIVE_BACKGROUND = 'rgba(255, 255, 255, 0.25)';
const TEXT_TERTIARY = '#475569';
const TEXT_PRIMARY = '#1F2937';
const STEP_BACKGROUND = '#D1FAE5';

// ---------------------------------------------------------------------------
// Skeleton list (loading state)
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 4;
const SKELETON_DATA = Array.from({ length: SKELETON_COUNT }, (_, i) => ({ key: String(i) }));

const SkeletonList: React.FC = () => (
  <View style={styles.listContent}>
    {SKELETON_DATA.map(item => (
      <SkeletonOrderCard key={item.key} />
    ))}
  </View>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  tab: TabKey;
  onBrowse: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ tab, onBrowse }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.surfaceContainer }]}>
        <Icon
          name={tab === 'active' ? 'receipt-outline' : 'time-outline'}
          family='Ionicons'
          size={56}
          color='#94A3B8'
        />
      </View>

      <Text style={styles.emptyTitle}>
        {tab === 'active' ? t('orders.noActiveOrders') : t('orders.noOrderHistory')}
      </Text>

      <Text style={styles.emptySubtitle}>
        {tab === 'active' ? t('orders.activeEmptyMessage') : t('orders.historyEmptyMessage')}
      </Text>

      {tab === 'active' && (
        <Button
          variant='primary'
          size='lg'
          onPress={onBrowse}
          leftIcon='restaurant-outline'
          leftIconFamily='Ionicons'
          style={styles.browseButton}
          accessibilityLabel={t('orders.browseOffers')}
          accessibilityHint={t('orders.a11yDiscoverOffersHint')}
        >
          {t('orders.browseOffers')}
        </Button>
      )}

      {/* How It Works card (only on active tab) */}
      {tab === 'active' && (
        <View style={styles.howItWorksCard}>
          <Text style={styles.howItWorksTitle}>{t('orders.howItWorks')}</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepText}>{t('orders.step1')}</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepText}>{t('orders.step2')}</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.stepText}>{t('orders.step3')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Tab Pill
// ---------------------------------------------------------------------------

interface TabPillProps {
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
}

const TabPill: React.FC<TabPillProps> = ({ label, count, isActive, onPress }) => {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabPill, isActive && styles.tabPillActive]}
      android_ripple={{ color: 'rgba(0, 82, 80, 0.1)', borderless: false }}
      accessibilityRole='tab'
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={t('orders.a11yOrderTab', { label, count })}
      accessibilityHint={t('orders.a11yOrderTabHint')}
    >
      <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={[styles.tabCountBadge, isActive && styles.tabCountBadgeActive]}>
          <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState<TabKey>('active');

  const {
    activeOrders,
    historyOrders,
    isLoading,
    isRefetching,
    refetch,
    loadMore,
    isFetchingNextPage,
  } = useOrders();
  const prefetchOrder = usePrefetchOrder();

  const currentOrders = useMemo(
    () => (selectedTab === 'active' ? activeOrders : historyOrders),
    [selectedTab, activeOrders, historyOrders],
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOrderPress = useCallback(
    (order: Order) => {
      prefetchOrder(order._id);
      navigation.navigate('OrderDetails', { orderId: order._id });
    },
    [navigation, prefetchOrder],
  );

  const handleBrowseOffers = useCallback(() => {
    navigation.jumpTo('Home');
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderOrderCard = useCallback(
    ({ item }: { item: Order }) => <OrderCard order={item} onPress={handleOrderPress} />,
    [handleOrderPress],
  );

  const keyExtractor = useCallback((item: Order) => item._id, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        <TabPill
          label={t('orders.active')}
          count={activeOrders.length}
          isActive={selectedTab === 'active'}
          onPress={() => setSelectedTab('active')}
        />
        <TabPill
          label={t('orders.history')}
          count={historyOrders.length}
          isActive={selectedTab === 'history'}
          onPress={() => setSelectedTab('history')}
        />
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <SkeletonList />
      ) : currentOrders.length === 0 ? (
        <EmptyState tab={selectedTab} onBrowse={handleBrowseOffers} />
      ) : (
        <FlashList
          data={currentOrders}
          renderItem={renderOrderCard}
          keyExtractor={keyExtractor}
          estimatedItemSize={152}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={selectedTab === 'history' ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage && selectedTab === 'history' ? (
              <ActivityIndicator style={styles.loadingFooter} color={theme.colors.primary} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: TAB_BORDER,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: TAB_BORDER,
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: BRAND_PRIMARY,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  tabPillTextActive: {
    color: WHITE,
  },
  tabCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BADGE_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabCountBadgeActive: {
    backgroundColor: BADGE_ACTIVE_BACKGROUND,
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_TERTIARY,
  },
  tabCountTextActive: {
    color: WHITE,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingFooter: {
    paddingVertical: 16,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    minWidth: 200,
    marginBottom: 32,
  },

  // How it works
  howItWorksCard: {
    width: '100%',
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  howItWorksTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: STEP_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_PRIMARY,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_TERTIARY,
    flex: 1,
  },
});
