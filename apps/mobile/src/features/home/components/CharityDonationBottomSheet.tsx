/**
 * CharityDonationBottomSheet
 * Explains our 5% charity programme — from the app's revenue, not the user's pocket.
 * Informative, warm, and emotionally resonant without being manipulative.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MonthlyGoalCauseType } from '@foodwaste/shared';

import { colorTokens } from '@/design-system/tokens/colors';

import { useMonthlyBagGoal } from '../hooks/useMonthlyBagGoal';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

// ─── Animation constants ──────────────────────────────────────────────────────

const OPEN_DURATION = 320;
const CLOSE_DURATION = 260;
const SHEET_START_Y = 700; // large enough to start below any screen

// ─── Cause config ─────────────────────────────────────────────────────────────

interface CauseConfig {
  emoji: string;
  accentColor: string;
  bgColor: string;
  defaultTitle: string;
  defaultStory: string;
}

const CAUSE_CONFIG: Record<MonthlyGoalCauseType, CauseConfig> = {
  FOOD: {
    emoji: '🍞',
    accentColor: '#E65100',
    bgColor: '#FFF3E0',
    defaultTitle: 'Food for Families in Need',
    defaultStory:
      'Every day, families across Tunisia struggle to put a meal on the table — not because food does not exist, but because it never reached them. Our donations go directly to food banks and local organisations that distribute meals to those who need them most.',
  },
  CLOTHING: {
    emoji: '👕',
    accentColor: '#1565C0',
    bgColor: '#E3F2FD',
    defaultTitle: 'Clothes for Children',
    defaultStory:
      'Thousands of children in Tunisia head to school wearing clothes that are worn out or too thin for the cold. Our donations fund the purchase and distribution of clothing to children whose families cannot afford them.',
  },
  EDUCATION: {
    emoji: '📚',
    accentColor: '#6A1B9A',
    bgColor: '#F3E5F5',
    defaultTitle: 'Education for Every Child',
    defaultStory:
      "Some families in Tunisia cannot afford school supplies, uniforms, or registration fees — and so their children stay home. Our donations cover those costs so that a child's future is never decided by their family's income.",
  },
  MEDICINE: {
    emoji: '💊',
    accentColor: '#B71C1C',
    bgColor: '#FFEBEE',
    defaultTitle: 'Medicine for Our Elders',
    defaultStory:
      "Many elderly men and women in Tunisia — our grandparents' generation — are forced to choose between food and medicine. Our donations go directly to pharmacies and health organisations to cover the cost of essential medication for those who cannot afford it.",
  },
};

const DEFAULT_CAUSE: CauseConfig = {
  emoji: '🤲',
  accentColor: colorTokens.base.primary[500],
  bgColor: '#E0F2F1',
  defaultTitle: 'Supporting Our Community',
  defaultStory:
    "Our donations support a rotating set of causes chosen based on the community's most urgent needs — food, clothing, education, and healthcare for those who cannot afford them.",
};

// ─── Step row ─────────────────────────────────────────────────────────────────

const Step = ({ emoji, label, isLast }: { emoji: string; label: string; isLast: boolean }) => (
  <View style={styles.stepRow}>
    <View style={styles.step}>
      <Text style={styles.stepEmoji}>{emoji}</Text>
      <Text style={styles.stepLabel} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </Text>
    </View>
    {!isLast && <Text style={styles.stepArrow}>›</Text>}
  </View>
);

// ─── Progress bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({ percentage }: { percentage: number }) => {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.min(percentage, 100),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percentage, width]);

  const animatedWidth = width.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: animatedWidth, backgroundColor: colorTokens.base.primary[500] },
        ]}
      />
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CharityDonationBottomSheet: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: stats } = useMonthlyBagGoal();

  // Keep Modal mounted until close animation fully finishes
  const [isModalMounted, setIsModalMounted] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_START_Y)).current;

  useEffect(() => {
    if (visible) {
      setIsModalMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: CLOSE_DURATION,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_START_Y,
          duration: CLOSE_DURATION,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setIsModalMounted(false));
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  const causeType = stats?.causeType;
  const cause = causeType ? (CAUSE_CONFIG[causeType] ?? DEFAULT_CAUSE) : DEFAULT_CAUSE;
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isModalMounted) return null;

  return (
    <Modal visible transparent animationType='none' onRequestClose={handleClose}>
      {/* Overlay — fades in/out smoothly, no hard edge */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable
          accessibilityRole='button'
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Sheet — slides up from below */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 24, transform: [{ translateY: sheetTranslateY }] },
        ]}
        pointerEvents='box-none'
      >
        {/* Handle */}
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Cause icon — static, no animation */}
          <View style={[styles.causeIconBadge, { backgroundColor: cause.bgColor }]}>
            <Text style={styles.causeIconEmoji}>{cause.emoji}</Text>
          </View>

          {/* Main headline */}
          <Text style={styles.headline}>{t('home.charityHeadline')}</Text>
          <Text style={styles.subline}>{t('home.charitySubline')}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* How it works */}
          <Text style={styles.sectionLabel}>{t('home.charityHowItWorks')}</Text>
          <View style={styles.stepsContainer}>
            <Step emoji='🛍' label={t('home.charityStep1')} isLast={false} />
            <Step emoji='💚' label={t('home.charityStep2')} isLast={false} />
            <Step emoji='🤲' label={t('home.charityStep3')} isLast />
          </View>

          {/* What the money funds */}
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>{t('home.charityImpactTitle')}</Text>

          <View style={styles.destinationsList}>
            <View style={styles.destinationRow}>
              <Text style={styles.destinationEmoji}>🍞</Text>
              <Text style={styles.destinationText}>
                <Text style={styles.destinationBold}>{t('home.charityMealsTitle')}</Text>
                {t('home.charityMealsDesc')}
              </Text>
            </View>
            <View style={styles.destinationRow}>
              <Text style={styles.destinationEmoji}>👕</Text>
              <Text style={styles.destinationText}>
                <Text style={styles.destinationBold}>{t('home.charityClothesTitle')}</Text>
                {t('home.charityClothesDesc')}
              </Text>
            </View>
            <View style={styles.destinationRow}>
              <Text style={styles.destinationEmoji}>📚</Text>
              <Text style={styles.destinationText}>
                <Text style={styles.destinationBold}>{t('home.charitySchoolTitle')}</Text>
                {t('home.charitySchoolDesc')}
              </Text>
            </View>
            <View style={styles.destinationRow}>
              <Text style={styles.destinationEmoji}>💊</Text>
              <Text style={styles.destinationText}>
                <Text style={styles.destinationBold}>{t('home.charityMedicineTitle')}</Text>
                {t('home.charityMedicineDesc')}
              </Text>
            </View>
          </View>

          {/* Community progress */}
          {stats != null && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{t('home.communityProgress')}</Text>
                <Text style={styles.progressFraction}>
                  {stats.currentCount.toLocaleString()} / {stats.targetCount.toLocaleString()}{' '}
                  {t('common.bags')}
                </Text>
              </View>
              <ProgressBar percentage={stats.progressPercentage} />
              <Text style={styles.progressCaption}>
                {t('home.charityMoreBags', { count: stats.remaining })}
              </Text>
            </View>
          )}

          {/* Close */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: colorTokens.base.primary[500] }]}
            onPress={handleClose}
            accessibilityRole='button'
            accessibilityLabel={t('common.close')}
            accessibilityHint={t('common.close')}
          >
            <Text style={styles.closeButtonText}>{t('home.gotIt')}</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 16 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: sp[3],
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  // Cause icon badge — static, no animation
  causeIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  causeIconEmoji: {
    fontSize: 36,
  },
  // Headline
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: colorTokens.base.neutral[900],
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 8,
  },
  subline: {
    fontSize: 14,
    color: colorTokens.base.neutral[700],
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: sp[5],
  },
  divider: {
    height: 1,
    backgroundColor: colorTokens.base.neutral[100],
    marginBottom: sp[5],
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colorTokens.base.neutral[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  // How it works steps
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: sp[5],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  step: {
    alignItems: 'center',
    maxWidth: 82,
    flexShrink: 1,
  },
  stepEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 11,
    color: colorTokens.base.neutral[700],
    textAlign: 'center',
    lineHeight: 15,
  },
  stepArrow: {
    fontSize: 20,
    color: colorTokens.base.neutral[300],
    marginHorizontal: 4,
    marginBottom: 16,
  },
  // Destinations list
  destinationsList: {
    gap: sp[3],
    marginBottom: sp[5],
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  destinationEmoji: {
    fontSize: 18,
    lineHeight: 24,
    width: 24,
    textAlign: 'center',
  },
  destinationText: {
    flex: 1,
    fontSize: 13,
    color: colorTokens.base.neutral[800],
    lineHeight: 20,
  },
  destinationBold: {
    fontWeight: '700',
    color: colorTokens.base.neutral[900],
  },
  // Progress
  progressSection: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colorTokens.base.neutral[800],
  },
  progressFraction: {
    fontSize: 12,
    color: colorTokens.base.neutral[700],
  },
  progressTrack: {
    height: 8,
    backgroundColor: colorTokens.base.neutral[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressCaption: {
    fontSize: 12,
    color: colorTokens.base.neutral[700],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Close button
  closeButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 4,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
