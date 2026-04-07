/**
 * Settings Screen
 * App settings and preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';

import { Text, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { Logger } from '@/utils/logger';

import { notificationPreferencesService } from '../services/notificationPreferencesService';

import type { NotificationPreferences } from '../services/notificationPreferencesService';
import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SettingsScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Settings'>;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation: _navigation }) => {
  const theme = useTheme();

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // ── Load preferences on mount — deferred until navigation animation completes ─
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const load = async () => {
        try {
          const prefs = await notificationPreferencesService.getPreferences();
          setPreferences(prefs);
        } catch (err) {
          Logger.error(
            'Failed to load notification preferences',
            undefined,
            err instanceof Error ? err : undefined,
          );
        } finally {
          setIsLoading(false);
        }
      };
      void load();
    });
    return () => task.cancel();
  }, []);

  // ── Toggle handlers ─────────────────────────────────────────────────────────
  const handleTogglePush = useCallback(
    async (value: boolean) => {
      if (!preferences) return;
      setUpdatingKey('globalPush');
      const optimistic = { ...preferences, globalPushEnabled: value };
      setPreferences(optimistic);
      try {
        const updated = await notificationPreferencesService.updatePreferences({
          globalPushEnabled: value,
        });
        setPreferences(updated);
      } catch (err) {
        setPreferences(preferences); // rollback
        Logger.error(
          'Failed to update push toggle',
          undefined,
          err instanceof Error ? err : undefined,
        );
      } finally {
        setUpdatingKey(null);
      }
    },
    [preferences],
  );

  const handleToggleFavoriteOffers = useCallback(
    async (value: boolean) => {
      if (!preferences) return;
      setUpdatingKey('favoriteOffers');
      const optimistic: NotificationPreferences = {
        ...preferences,
        channels: {
          ...preferences.channels,
          offers: {
            push: value,
            email: preferences.channels.offers?.email ?? false,
            sms: preferences.channels.offers?.sms ?? false,
          },
        },
      };
      setPreferences(optimistic);
      try {
        const updated = await notificationPreferencesService.updatePreferences({
          channels: {
            offers: {
              push: value,
              email: preferences.channels.offers?.email ?? false,
              sms: preferences.channels.offers?.sms ?? false,
            },
          },
        });
        setPreferences(updated);
      } catch (err) {
        setPreferences(preferences); // rollback
        Logger.error(
          'Failed to update offers toggle',
          undefined,
          err instanceof Error ? err : undefined,
        );
      } finally {
        setUpdatingKey(null);
      }
    },
    [preferences],
  );

  // ── Derived values ──────────────────────────────────────────────────────────
  const pushEnabled = preferences?.globalPushEnabled ?? false;
  const favoriteOffersEnabled = preferences?.channels?.offers?.push ?? false;
  // Favorite offers toggle is disabled when master push is off
  const favoriteOffersDisabled = !pushEnabled || updatingKey !== null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Notifications Section */}
        <Card style={styles.card}>
          <Text variant='headline.medium' weight='semibold' style={styles.sectionTitle}>
            Notifications
          </Text>

          {isLoading ? (
            <ActivityIndicator size='small' color={theme.colors.primary} style={styles.loader} />
          ) : (
            <>
              {/* Master push toggle */}
              <View style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}>
                <View style={styles.rowText}>
                  <Text variant='body.medium' weight='medium'>
                    Push Notifications
                  </Text>
                  <Text variant='body.small' color='secondary' style={styles.rowSubtitle}>
                    Enable or disable all push notifications
                  </Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={value => {
                    void handleTogglePush(value);
                  }}
                  disabled={updatingKey === 'globalPush'}
                  trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                  ios_backgroundColor={theme.colors.outlineVariant}
                />
              </View>

              {/* Favorite store offers toggle */}
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text
                    variant='body.medium'
                    weight='medium'
                    style={!pushEnabled ? styles.disabledText : undefined}
                  >
                    Favorite Store Offers
                  </Text>
                  <Text variant='body.small' color='secondary' style={styles.rowSubtitle}>
                    Get notified when your favorite stores post new offers
                  </Text>
                </View>
                <Switch
                  value={favoriteOffersEnabled && pushEnabled}
                  onValueChange={value => {
                    void handleToggleFavoriteOffers(value);
                  }}
                  disabled={favoriteOffersDisabled}
                  trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                  ios_backgroundColor={theme.colors.outlineVariant}
                />
              </View>
            </>
          )}
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
  sectionTitle: {
    marginBottom: 8,
  },
  loader: {
    marginVertical: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  disabledText: {
    opacity: 0.4,
  },
});
