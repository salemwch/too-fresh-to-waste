/**
 * CharityDonationBottomSheet
 * Explains the 5% charity mechanism and displays the current live community cause.
 * Designed to create genuine emotional connection — users should feel their purchase matters.
 */

import React, { useEffect, useRef, useCallback } from 'react';
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

import { CommunityGoalCauseType } from '@foodwaste/shared';

import { colorTokens } from '@/design-system/tokens/colors';

import { useCommunityBagGoal } from '../hooks/useCommunityBagGoal';

// ─── Cause config ─────────────────────────────────────────────────────────────

interface CauseConfig {
  emoji: string;
  accentColor: string;
  bgColor: string;
  defaultTitle: string;
  defaultStory: string;
}

const CAUSE_CONFIG: Record<CommunityGoalCauseType, CauseConfig> = {
  [CommunityGoalCauseType.FOOD]: {
    emoji: '🍞',
    accentColor: '#E65100',
    bgColor: '#FFF3E0',
    defaultTitle: 'Feeding Families in Need',
    defaultStory:
      "Every night, families across Tunisia go to bed unsure about tomorrow's meal. Children fall asleep hungry — not because there isn't enough food in the world, but because it never reached them. Your bag changes that.",
  },
  [CommunityGoalCauseType.CLOTHING]: {
    emoji: '👕',
    accentColor: '#1565C0',
    bgColor: '#E3F2FD',
    defaultTitle: 'Warmth for Those Who Have None',
    defaultStory:
      'As temperatures drop, thousands of people in Tunisia face the cold without a warm jacket. A child walks to school shivering. An elderly woman wraps herself in a thin blanket. One bag saved means one person kept warm.',
  },
  [CommunityGoalCauseType.EDUCATION]: {
    emoji: '📚',
    accentColor: '#6A1B9A',
    bgColor: '#F3E5F5',
    defaultTitle: 'Every Child Deserves to Learn',
    defaultStory:
      "Somewhere right now, a bright child is unable to go to school because their family can't afford notebooks or fees. Education is the one gift that no one can take away — and together, we're giving it.",
  },
  [CommunityGoalCauseType.MEDICINE]: {
    emoji: '💊',
    accentColor: '#B71C1C',
    bgColor: '#FFEBEE',
    defaultTitle: 'Medicine for Our Elders',
    defaultStory:
      "Our grandparents built everything we have. Now some of them are forced to choose between food and medicine. With every bag you save, you're making sure an elder gets the treatment they deserve.",
  },
};

const DEFAULT_CAUSE: CauseConfig = {
  emoji: '🤲',
  accentColor: colorTokens.base.primary[500],
  bgColor: '#E0F2F1',
  defaultTitle: 'Supporting Our Community',
  defaultStory:
    'Every bag you save is more than just food rescued from waste — it is a small act of kindness that ripples outward. Together, we are building a Tunisia where no one is left behind.',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PulsingEmoji = ({ emoji, color }: { emoji: string; color: string }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.6,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, glow]);

  return (
    <View style={styles.emojiWrapper}>
      <Animated.View
        style={[
          styles.emojiGlow,
          { backgroundColor: color, opacity: glow, transform: [{ scale }] },
        ]}
      />
      <Animated.Text style={[styles.emoji, { transform: [{ scale }] }]}>{emoji}</Animated.Text>
    </View>
  );
};

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

// ─── Step item — responsive, wraps gracefully on small screens ────────────────

const HowItWorksStep = ({
  emoji,
  label,
  isLast,
}: {
  emoji: string;
  label: string;
  isLast: boolean;
}) => (
  <View style={styles.stepRow}>
    <View style={styles.step}>
      <Text style={styles.stepEmoji}>{emoji}</Text>
      <Text style={styles.stepLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </View>
    {!isLast && <Text style={styles.stepArrow}>›</Text>}
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onCtaPress?: () => void;
}

export const CharityDonationBottomSheet: React.FC<Props> = ({ visible, onClose, onCtaPress }) => {
  const insets = useSafeAreaInsets();
  const { data: stats } = useCommunityBagGoal();

  const causeType = stats?.causeType;
  const cause = causeType ? (CAUSE_CONFIG[causeType] ?? DEFAULT_CAUSE) : DEFAULT_CAUSE;
  const title = stats?.causeTitle ?? cause.defaultTitle;
  const story = stats?.causeDescription ?? cause.defaultStory;

  const handleCta = useCallback(() => {
    onClose();
    onCtaPress?.();
  }, [onClose, onCtaPress]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Animated cause icon */}
            <PulsingEmoji emoji={cause.emoji} color={cause.accentColor} />

            {/* Emotional hook */}
            <Text style={styles.hookLine}>Every bag you save{'\n'}changes a life.</Text>
            <Text style={styles.subHook}>While you save money, someone somewhere finds hope.</Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* How it works */}
            <Text style={styles.sectionLabel}>Here's how it works</Text>
            <View style={styles.stepsContainer}>
              <HowItWorksStep emoji='🛍' label='You save a bag' isLast={false} />
              <HowItWorksStep emoji='💚' label='5% goes to our charity pool' isLast={false} />
              <HowItWorksStep emoji='🤲' label='Real people are helped' isLast />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Live cause card */}
            <View
              style={[
                styles.causeCard,
                { borderLeftColor: cause.accentColor, backgroundColor: cause.bgColor },
              ]}
            >
              <View style={styles.causeCardHeader}>
                <Text style={styles.causeEmoji}>{cause.emoji}</Text>
                <Text
                  style={[styles.causeCardTitle, { color: cause.accentColor }]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </View>
              <Text style={styles.causeStory}>{story}</Text>
            </View>

            {/* Community progress */}
            {stats != null && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Community Progress</Text>
                  <Text style={styles.progressFraction}>
                    {stats.currentCount.toLocaleString()} / {stats.targetCount.toLocaleString()}{' '}
                    bags
                  </Text>
                </View>
                <ProgressBar percentage={stats.progressPercentage} />
                <Text style={styles.progressCaption}>
                  {stats.remaining.toLocaleString()} more bags until we fund the next cause
                </Text>
              </View>
            )}

            {/* CTA */}
            <Pressable
              style={[styles.cta, { backgroundColor: colorTokens.base.primary[500] }]}
              onPress={handleCta}
              accessibilityRole='button'
              accessibilityLabel='Start saving bags'
            >
              <Text style={styles.ctaText}>Start Saving Bags 🛍</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
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
    marginTop: 12,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  // Emoji
  emojiWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 96,
    marginBottom: 16,
  },
  emojiGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  emoji: {
    fontSize: 52,
    lineHeight: 64,
  },
  // Hook
  hookLine: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
  },
  subHook: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  // How it works
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'nowrap',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  step: {
    alignItems: 'center',
    maxWidth: 88,
    flexShrink: 1,
  },
  stepEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 15,
  },
  stepArrow: {
    fontSize: 22,
    color: '#D1D5DB',
    marginHorizontal: 4,
    marginBottom: 18,
  },
  // Cause card
  causeCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  causeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  causeEmoji: {
    fontSize: 20,
  },
  causeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    lineHeight: 22,
  },
  causeStory: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
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
    color: '#374151',
  },
  progressFraction: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
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
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // CTA
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
