/**
 * Settings Screen
 * App settings and preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  I18nManager,
  Linking,
  View,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  InteractionManager,
  Pressable,
} from 'react-native';
import RNRestart from 'react-native-restart';

import { Text, Card } from '@/design-system/components/atoms';
import { SUPPORTED_LANGUAGES, setStoredLanguage, getCurrentLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n';
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

// Geoapify's free tier permits commercial use only while this attribution stays
// visible, and requires this exact wording — do not translate the brand string.
const GEOAPIFY_URL = 'https://www.geoapify.com/';
const GEOAPIFY_ATTRIBUTION = 'Powered by Geoapify';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState<AppLanguage>(getCurrentLanguage());

  const handleLanguageChange = useCallback(
    (lang: AppLanguage) => {
      if (lang === currentLang) return;

      const wasRTL = I18nManager.isRTL;
      const willBeRTL = lang === 'ar';
      const directionChanges = wasRTL !== willBeRTL;

      setStoredLanguage(lang);
      void i18n.changeLanguage(lang);
      setCurrentLang(lang);

      if (directionChanges) {
        // Save the RTL preference so it applies on the next launch
        I18nManager.forceRTL(willBeRTL);
        I18nManager.allowRTL(willBeRTL);

        // Android requires Activity recreation for layout direction to take effect.
        // Prompt the user to restart now — on relaunch the correct RTL/LTR layout loads.
        setTimeout(() => {
          Alert.alert(t('settings.restartRequired'), t('settings.restartMessage'), [
            { text: t('settings.restartLater'), style: 'cancel' },
            {
              text: t('settings.restartNow'),
              style: 'destructive',
              onPress: () => RNRestart.restart(),
            },
          ]);
        }, 300);
      }
    },
    [currentLang, i18n, t],
  );

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
            {t('settings.notifications')}
          </Text>

          {isLoading ? (
            <ActivityIndicator size='small' color={theme.colors.primary} style={styles.loader} />
          ) : (
            <>
              {/* Master push toggle */}
              <View style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}>
                <View style={styles.rowText}>
                  <Text variant='body.medium' weight='medium'>
                    {t('settings.pushNotifications')}
                  </Text>
                  <Text variant='body.small' color='secondary' style={styles.rowSubtitle}>
                    {t('settings.pushDescription')}
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
                    {t('settings.favoriteStoreOffers')}
                  </Text>
                  <Text variant='body.small' color='secondary' style={styles.rowSubtitle}>
                    {t('settings.favoriteStoreDescription')}
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

        {/* Language Section */}
        <Card style={[styles.card, styles.languageCard]}>
          <Text variant='headline.medium' weight='semibold' style={styles.sectionTitle}>
            {t('settings.language')}
          </Text>

          <View style={[styles.pillContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            {(
              Object.entries(SUPPORTED_LANGUAGES) as [
                AppLanguage,
                (typeof SUPPORTED_LANGUAGES)[AppLanguage],
              ][]
            ).map(([code, lang]) => {
              const isSelected = currentLang === code;
              return (
                <Pressable
                  key={code}
                  style={[
                    styles.languagePill,
                    isSelected && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => handleLanguageChange(code)}
                  accessibilityRole='radio'
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${lang.label} (${lang.nativeLabel})`}
                  accessibilityHint={t('settings.a11ySwitchLanguageHint')}
                >
                  <Text
                    variant='body.medium'
                    weight={isSelected ? 'semibold' : 'medium'}
                    style={{ color: isSelected ? '#FFFFFF' : theme.colors.onSurfaceVariant }}
                  >
                    {lang.nativeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Attributions Section */}
        <Card style={[styles.card, styles.attributionCard]}>
          <Text variant='headline.medium' weight='semibold' style={styles.sectionTitle}>
            {t('settings.attributions')}
          </Text>

          <Text variant='body.small' color='secondary' style={styles.rowSubtitle}>
            {t('settings.geocodingAttribution')}
          </Text>

          <Pressable
            onPress={() => {
              void Linking.openURL(GEOAPIFY_URL);
            }}
            style={styles.attributionLink}
            accessibilityRole='link'
            accessibilityLabel={GEOAPIFY_ATTRIBUTION}
            accessibilityHint={t('settings.a11yOpenGeoapifyHint')}
          >
            <Text
              variant='body.medium'
              weight='medium'
              style={[styles.attributionText, { color: theme.colors.primary }]}
            >
              {GEOAPIFY_ATTRIBUTION}
            </Text>
          </Pressable>
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
    marginEnd: 12,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  disabledText: {
    opacity: 0.4,
  },
  languageCard: {
    marginTop: 16,
  },
  pillContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginTop: 4,
  },
  languagePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  attributionCard: {
    marginTop: 16,
  },
  attributionLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  attributionText: {
    textDecorationLine: 'underline',
  },
});
