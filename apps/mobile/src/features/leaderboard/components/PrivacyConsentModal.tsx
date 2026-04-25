/**
 * PrivacyConsentModal
 *
 * Non-dismissible bottom sheet that gates leaderboard participation.
 * Shown once on first leaderboard visit; re-used by PrivacyScreen for updates.
 *
 * Two buttons — no text input, no multi-step flow:
 *   "Show my name & photo"  → PATCH { showRealName: true }
 *   "Stay anonymous"        → PATCH { showRealName: false }
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colorTokens } from '@/design-system/tokens/colors';

import { useLeaderboardConsent } from '../hooks/useLeaderboardConsent';

const PRIMARY = colorTokens.base.primary[500];
const SURFACE = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const OVERLAY = 'rgba(0,0,0,0.5)';
const INVERSE_TEXT = '#FFFFFF';

export interface PrivacyConsentModalProps {
  visible: boolean;
  /** Called after the PATCH succeeds and query cache is invalidated */
  onConsentSaved: () => void;
}

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  visible,
  onConsentSaved,
}) => {
  const insets = useSafeAreaInsets();
  const mutation = useLeaderboardConsent();

  const handleChoice = (showRealName: boolean) => {
    mutation.mutate(showRealName, {
      onSuccess: onConsentSaved,
    });
  };

  const sheetBottomPad = Math.max(insets.bottom, 20);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      statusBarTranslucent
      // Non-dismissible: hardware back does nothing
      onRequestClose={() => undefined}
    >
      {/* Backdrop — tap does nothing (non-dismissible) */}
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole='button'
          style={styles.overlayFill}
          onPress={() => undefined}
        />

        <View style={[styles.sheet, { paddingBottom: sheetBottomPad }]}>
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Icon */}
            <Text style={styles.icon}>🏆</Text>

            {/* Heading */}
            <Text style={styles.heading}>Leaderboard Display</Text>

            {/* Body */}
            <Text style={styles.body}>
              Your loyalty points are being tracked. Do you want to appear on the community
              leaderboard with your name and photo, or stay anonymous?
            </Text>

            <Text style={styles.hint}>You can change this any time in Privacy settings.</Text>
          </ScrollView>

          {/* Primary button — real identity */}
          <Pressable
            accessibilityRole='button'
            style={[styles.btnPrimary, mutation.isPending && styles.btnDisabled]}
            onPress={() => handleChoice(true)}
            disabled={mutation.isPending}
          >
            {mutation.isPending && mutation.variables === true ? (
              <ActivityIndicator color={INVERSE_TEXT} size='small' />
            ) : (
              <Text style={styles.btnPrimaryTxt}>{'Show my name & photo'}</Text>
            )}
          </Pressable>

          {/* Secondary button — anonymous */}
          <Pressable
            accessibilityRole='button'
            style={[styles.btnOutline, mutation.isPending && styles.btnDisabled]}
            onPress={() => handleChoice(false)}
            disabled={mutation.isPending}
          >
            {mutation.isPending && mutation.variables === false ? (
              <ActivityIndicator color={PRIMARY} size='small' />
            ) : (
              <Text style={styles.btnOutlineTxt}>Stay anonymous</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'flex-end',
  },
  // Fills the backdrop area above the sheet; taps are absorbed (no-op)
  overlayFill: {
    flex: 1,
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '70%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 24,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  hint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    opacity: 0.7,
  },
  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnOutline: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: INVERSE_TEXT,
  },
  btnOutlineTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
});
