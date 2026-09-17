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

import { setAppDirection } from '@/i18n/direction';
import { Text, Card } from '@/design-system/components/atoms';
import { SUPPORTED_LANGUAGES, setStoredLanguage, getCurrentLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n';
import { DARK_MODE_ENABLED, useTheme } from '@/design-system/providers';
import { Logger } from '@/utils/logger';

import { notificationPreferencesService } from '../services/notificationPreferencesService';

import type { ThemeMode } from '@/design-system/types';
import type { NotificationPreferences } from '../services/notificationPreferencesService';
import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

type SettingsScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Settings'>;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
}

// Geoapify's free tier permits commercial use only while this attribution stays
// visible, and requires this exact wording — do not translate the brand string.
const GEOAPIFY_URL = 'https://www.geoapify.com/';
const GEOAPIFY_ATTRIBUTION = 'Powered by Geoapify';

/**
 * Appearance options, in the order they are shown.
 *
 * `auto` is offered but is **not** the app default - `App.tsx` still mounts
 * `defaultTheme='light'` deliberately. Until every screen has been verified in
 * dark (MOBILE_DESIGN_DECISION_BRIEF.md MD3, phase 6), defaulting to `auto`
 * would flip a large share of users onto a theme nobody has checked. Choosing it
 * here is opt-in, which is exactly what makes dark reachable for testing.
 *
 * Unlike a language change this needs no restart: `ThemeProvider` recomputes
 * `colorScheme` from React state, so the tree re-renders in place.
 */
const THEME_OPTIONS: ReadonlyArray<{ mode: ThemeMode; labelKey: string }> = [
  { mode: 'light', labelKey: 'settings.themeLight' },
  { mode: 'dark', labelKey: 'settings.themeDark' },
  { mode: 'auto', labelKey: 'settings.themeAuto' },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState<AppLanguage>(getCurrentLanguage());

  /**
   * No restart, no confirmation: the provider recomputes from state, so the
   * change is immediate and reversible in one tap. That is the whole reason
   * this is safe to ship while `auto` is still not the default.
   */
  const handleThemeChange = useCallback(
    (mode: ThemeMode) => {
      if (mode === theme.mode) return;
      theme.setTheme(mode);
      Logger.info('Theme changed', { mode });
    },
    [theme],
  );

  const handleLanguageChange = useCallback(
    (lang: AppLanguage) => {
      if (lang === currentLang) return;

      const wasRTL = currentLang === 'ar';
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
              onPress: () => {
                /*
                 * PUBLISH THE DIRECTION BEFORE RESTARTING, OR JS AND THE LAYOUT
                 * DISAGREE FOR THE WHOLE SESSION.
                 *
                 * `RNRestart.restart()` tries `recreateReactContextInBackground()`
                 * and falls back to `Activity.recreate()` - which is the path
                 * taken here, since the instance-manager API it wants belongs to
                 * the old architecture. `recreate()` rebuilds the native side, so
                 * the layout picks the new direction up, but the JS context is
                 * NOT re-created: `@/i18n` does not run again, so the direction
                 * it published at startup would stand for the rest of the
                 * session.
                 *
                 * Measured before this line existed: after switching to Arabic
                 * this way, the layout was mirrored while every chevron, every
                 * gradient and every `textAlignStart` still answered LTR.
                 *
                 * Set here rather than next to `forceRTL` above on purpose. The
                 * "Later" button leaves the native layout alone, and JS must
                 * stay with it - a direction published now would mirror the
                 * icons over an unmirrored layout until the user restarted.
                 */
                setAppDirection(willBeRTL ? 'rtl' : 'ltr');
                RNRestart.restart();
              },
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
              {/* The colour is required. `styles.row` sets borderBottomWidth
                  but no borderBottomColor, and React Native's default border
                  colour is black - so this row rendered a full-strength black
                  rule (20.12 contrast) directly below its sibling's #E0E0E0
                  one. Device-verified on 2026-08-30. */}
              <View style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}>
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
                    style={selectedLanguageLabelStyle(isSelected, theme)}
                  >
                    {lang.nativeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Appearance Section - hidden while the dark rollout gate is closed.
            The control is the only caller of setTheme, so with it hidden the
            saved theme never changes; App.tsx also locks the provider so an
            already-saved dark preference cannot leave anyone stuck. */}
        {DARK_MODE_ENABLED && (
          <Card style={[styles.card, styles.appearanceCard]}>
            <Text variant='headline.medium' weight='semibold' style={styles.sectionTitle}>
              {t('settings.appearance')}
            </Text>

            <Text variant='body.small' color='secondary' style={styles.rowSubtitle}>
              {t('settings.appearanceDescription')}
            </Text>

            <View
              style={[styles.pillContainer, { backgroundColor: theme.colors.surfaceVariant }]}
              accessibilityRole='radiogroup'
              accessibilityLabel={t('settings.appearance')}
              accessibilityHint={t('settings.appearanceDescription')}
            >
              {THEME_OPTIONS.map(({ mode, labelKey }) => {
                const isSelected = theme.mode === mode;
                return (
                  <Pressable
                    key={mode}
                    testID={`theme-option-${mode}`}
                    style={[
                      styles.languagePill,
                      isSelected && { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => handleThemeChange(mode)}
                    accessibilityRole='radio'
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t(labelKey)}
                    accessibilityHint={t('settings.a11ySwitchThemeHint')}
                  >
                    <Text
                      variant='body.medium'
                      weight={isSelected ? 'semibold' : 'medium'}
                      style={selectedLanguageLabelStyle(isSelected, theme)}
                    >
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

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

/**
 * Selected language chip sits on the primary fill, so its label needs the
 * on-primary colour. Returning the object from a helper keeps the literal out of
 * JSX and off the raw-hex list in .claude/rules/ui-ux.md.
 */
const selectedLanguageLabelStyle = (isSelected: boolean, theme: ReturnType<typeof useTheme>) => ({
  color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    padding: sp[5],
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
    marginEnd: sp[3],
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
  appearanceCard: {
    marginTop: 16,
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
