/**
 * Privacy Screen
 * Privacy settings and data management
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';

const BORDER = '#E5E7EB';
import { deleteAccountAsync } from '@/features/auth/store/authSlice';
import { PrivacyConsentModal } from '@/features/leaderboard/components/PrivacyConsentModal';
import { useLoyalty } from '@/features/loyalty/hooks/useLoyalty';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { showAlert } from '@/utils/alert';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type PrivacyScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Privacy'>;

const PRIMARY = colorTokens.base.primary[500];
const DANGER_BORDER = '#ffebee';

interface PrivacyScreenProps {
  navigation: PrivacyScreenNavigationProp;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(state => state.auth.isLoading);

  const { account } = useLoyalty();
  const [consentModalVisible, setConsentModalVisible] = useState(false);

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
            dispatch(deleteAccountAsync()).catch(() => undefined);
          },
        },
      ],
      { type: 'error' },
    );
  }, [dispatch]);

  const consent = account?.leaderboardConsent;
  const consentLabel = !consent?.given
    ? 'Not set'
    : consent.showRealName
      ? 'Showing real name & photo'
      : 'Showing as Anonymous';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            {'Privacy & Data'}
          </Text>

          {/* ── Leaderboard Display ── */}
          <View style={styles.section}>
            <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
              Leaderboard Display
            </Text>
            <Pressable
              style={[styles.settingRow, { borderColor: BORDER }]}
              onPress={() => setConsentModalVisible(true)}
              accessibilityRole='button'
              accessibilityLabel='Edit community leaderboard display'
              accessibilityHint='Opens leaderboard privacy settings'
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>🏆</Text>
                <View>
                  <Text variant='body' size='md' weight='medium' color='primary'>
                    Community Leaderboard
                  </Text>
                  <Text variant='body' size='sm' color='secondary'>
                    {consentLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.editLabel, { color: PRIMARY }]}>Edit</Text>
            </Pressable>
          </View>

          {/* ── Danger Zone ── */}
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
  card: { padding: 20 },
  title: { marginBottom: 24 },

  // ── Leaderboard section ──
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12 },
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
    gap: 12,
    flex: 1,
  },
  settingIcon: { fontSize: 22 },
  editLabel: { fontSize: 14, fontWeight: '600' },

  // ── Danger zone ──
  dangerZone: {
    padding: 16,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
  },
  dangerTitle: { marginBottom: 12 },
  button: { marginTop: 12 },
});
