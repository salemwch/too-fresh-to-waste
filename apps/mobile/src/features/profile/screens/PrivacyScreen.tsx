/**
 * Privacy Screen
 * Privacy settings and data management
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable, Linking, Share } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';

const BORDER = colorTokens.base.neutral[200];
import { deleteAccountAsync } from '@/features/auth/store/authSlice';
import { PrivacyConsentModal } from '@/features/leaderboard/components/PrivacyConsentModal';
import { useLoyalty } from '@/features/loyalty/hooks/useLoyalty';
import { privacyService } from '@/features/profile/services/privacyService';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { showAlert } from '@/utils/alert';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

type PrivacyScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Privacy'>;

const PRIMARY = colorTokens.base.primary[500];
const DANGER_BORDER = '#ffebee';

/** Safely under Android's ~1 MB Binder limit for the share intent, UTF-16 included. */
const MAX_SHARE_CHARS = 200_000;

interface PrivacyScreenProps {
  navigation: PrivacyScreenNavigationProp;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ navigation: _navigation }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  // The website has the same pages in every app language; open the reader's.
  const siteLocale = ['en', 'fr', 'ar'].includes(i18n.language) ? i18n.language : 'en';
  const [isExporting, setIsExporting] = useState(false);
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(state => state.auth.isLoading);

  const { account } = useLoyalty();
  const [consentModalVisible, setConsentModalVisible] = useState(false);

  /*
   * "Download my data" was a button wired to `() => {}`: it did nothing. It
   * now requests the export the backend already serves and opens the share
   * sheet. Android's share intent is bounded by the Binder transaction limit
   * (about 1 MB), so an export beyond a safe size is refused with a message
   * instead of crashing the app with TransactionTooLargeException.
   */
  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = await privacyService.exportMyData();
      const message = JSON.stringify(data, null, 2);
      if (message.length > MAX_SHARE_CHARS) {
        showAlert(t('profile.exportFailedTitle'), t('profile.exportTooLargeBody'), undefined, {
          type: 'error',
        });
        return;
      }
      await Share.share({ title: t('profile.myDataTitle'), message });
    } catch {
      showAlert(t('profile.exportFailedTitle'), t('profile.exportFailedBody'), undefined, {
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  const handleDeleteAccount = useCallback(() => {
    showAlert(
      t('profile.deleteAccountTitle'),
      t('profile.deleteAccountBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch(deleteAccountAsync()).catch(() => undefined);
          },
        },
      ],
      { type: 'error' },
    );
  }, [dispatch, t]);

  const consent = account?.leaderboardConsent;
  const consentLabel = !consent?.given
    ? t('profile.consentNotSet')
    : consent.showRealName
      ? t('profile.consentRealName')
      : t('profile.consentAnonymous');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            {'Privacy & Data'}
          </Text>

          {/* ── Legal Documents ── */}
          <View style={styles.section}>
            <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
              Legal
            </Text>
            <Pressable
              style={[styles.settingRow, { borderColor: BORDER }]}
              onPress={() => {
                void Linking.openURL(`https://toofreshtowaste.com/${siteLocale}/privacy-policy`);
              }}
              accessibilityRole='link'
              accessibilityLabel={t('profile.a11yViewPrivacyPolicy')}
              accessibilityHint={t('common.a11yOpenLinkHint')}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>🔒</Text>
                <Text variant='body' size='md' weight='medium' color='primary'>
                  {t('profile.privacyPolicy')}
                </Text>
              </View>
              <Text style={[styles.editLabel, { color: PRIMARY }]}>{t('profile.view')}</Text>
            </Pressable>
            <Pressable
              style={[styles.settingRow, styles.settingRowTop, { borderColor: BORDER }]}
              onPress={() => {
                void Linking.openURL(
                  `https://toofreshtowaste.com/${siteLocale}/terms-and-conditions`,
                );
              }}
              accessibilityRole='link'
              accessibilityLabel={t('profile.a11yViewTerms')}
              accessibilityHint={t('common.a11yOpenLinkHint')}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>📄</Text>
                <Text variant='body' size='md' weight='medium' color='primary'>
                  {t('profile.termsConditions')}
                </Text>
              </View>
              <Text style={[styles.editLabel, { color: PRIMARY }]}>{t('profile.view')}</Text>
            </Pressable>
          </View>

          {/* ── Leaderboard Display ── */}
          <View style={styles.section}>
            <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
              {t('profile.leaderboardDisplay')}
            </Text>
            <Pressable
              style={[styles.settingRow, { borderColor: BORDER }]}
              onPress={() => setConsentModalVisible(true)}
              accessibilityRole='button'
              accessibilityLabel={t('profile.a11yEditLeaderboardDisplay')}
              accessibilityHint={t('profile.a11yEditLeaderboardHint')}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>🏆</Text>
                <View>
                  <Text variant='body' size='md' weight='medium' color='primary'>
                    {t('profile.communityLeaderboard')}
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    {consentLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.editLabel, { color: PRIMARY }]}>{t('common.edit')}</Text>
            </Pressable>
          </View>

          {/* ── Danger Zone ── */}
          <Card style={styles.dangerZone}>
            <Text variant='title' size='md' weight='semibold' style={styles.dangerTitle}>
              {t('profile.dangerZone')}
            </Text>
            <Button
              variant='outline'
              size='md'
              onPress={handleExportData}
              loading={isExporting}
              disabled={isExporting}
              style={[styles.button, { borderColor: theme.colors.error }]}
              textStyle={{ color: theme.colors.error }}
            >
              {t('profile.downloadMyData')}
            </Button>
            <Button
              variant='outline'
              size='md'
              onPress={handleDeleteAccount}
              loading={isLoading}
              style={[styles.button, { borderColor: theme.colors.error }]}
              textStyle={{ color: theme.colors.error }}
            >
              {t('profile.deleteAccount')}
            </Button>
          </Card>
        </Card>
      </ScrollView>

      <PrivacyConsentModal
        visible={consentModalVisible}
        onConsentSaved={() => setConsentModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },
  card: { padding: sp[5] },
  title: { marginBottom: 24 },

  // ── Leaderboard section ──
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: sp[3] },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
    flex: 1,
  },
  settingRowTop: { marginTop: 8 },
  settingIcon: { fontSize: 22 },
  editLabel: { fontSize: 14, fontWeight: '600' },

  // ── Danger zone ──
  dangerZone: {
    padding: 16,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
  },
  dangerTitle: { marginBottom: sp[3] },
  button: { marginTop: sp[3] },
});
