/**
 * Favorites Screen
 * Display user's saved/favorited offers
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { FavoritesScreenNavigationProp } from '@/navigation/types';

interface FavoritesScreenProps {
  navigation: FavoritesScreenNavigationProp;
}

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const theme = useTheme();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [hasFavorites] = useState(false);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch user's favorite offers
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  /**
   * Navigate to search to find offers
   */
  const handleBrowseOffers = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Empty State */}
        {!hasFavorites && (
          <View style={styles.emptyState}>
            <View
              style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceContainer }]}
            >
              <Icon
                name='heart-outline'
                family='Ionicons'
                size={64}
                color={theme.colors.onSurfaceVariant}
              />
            </View>

            <Text variant='headline' size='lg' weight='semibold' align='center'>
              No Favorites Yet
            </Text>

            <Text
              variant='body'
              size='md'
              color='secondary'
              align='center'
              style={styles.emptyStateDescription}
            >
              Save your favorite offers to quickly access them later. Tap the heart icon on any
              offer to add it here.
            </Text>

            <Button
              variant='primary'
              size='lg'
              onPress={handleBrowseOffers}
              leftIcon='search-outline'
              leftIconFamily='Ionicons'
              style={styles.browseButton}
            >
              Browse Offers
            </Button>

            {/* Tips Card */}
            <Card style={styles.tipsCard}>
              <View style={styles.tipItem}>
                <Icon
                  name='bulb-outline'
                  family='Ionicons'
                  size={24}
                  color={theme.colors.warning}
                />
                <View style={styles.tipContent}>
                  <Text variant='body' size='sm' weight='medium'>
                    Pro Tip
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    Favorite offers you want to order from regularly to stay notified of new deals
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Favorites List Placeholder */}
        {hasFavorites && (
          <View style={styles.favoritesSection}>
            <View style={styles.header}>
              <Text variant='title' size='lg' weight='semibold'>
                My Favorites
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                0 saved offers
              </Text>
            </View>

            {/* Filter Options */}
            <View style={styles.filterSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
              >
                <Button variant='outline' size='sm' style={styles.filterButton}>
                  All
                </Button>
                <Button variant='ghost' size='sm' style={styles.filterButton}>
                  Available Now
                </Button>
                <Button variant='ghost' size='sm' style={styles.filterButton}>
                  Nearby
                </Button>
              </ScrollView>
            </View>

            {/* Favorites List (Placeholder) */}
            <Card style={styles.placeholderCard}>
              <Text variant='body' size='md' color='secondary' align='center'>
                Your favorite offers will appear here
              </Text>
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
  tipsCard: {
    padding: 16,
    width: '100%',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  favoritesSection: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
  },
  filterButton: {
    marginRight: 0,
  },
  placeholderCard: {
    padding: 48,
    alignItems: 'center',
  },
});
