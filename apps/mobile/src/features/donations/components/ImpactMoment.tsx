/**
 * ImpactMoment Component
 * Beautiful post-purchase animation showing user's donation impact
 * Enterprise-grade with smooth animations and error handling
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Dimensions,
  Pressable,
} from 'react-native';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

interface ImpactMomentProps {
  visible: boolean;
  donationAmount: number;
  totalDonations: number;
  mealCount: number;
  onDismiss: () => void;
  currency?: string;
}

const { width } = Dimensions.get('window');

const COLORS = {
  overlay: 'rgba(0, 0, 0, 0.85)',
  surface: '#FFFFFF',
  shadow: '#000',
  textPrimary: colorTokens.base.neutral[900],
  textSecondary: colorTokens.base.neutral[700],
  success: colorTokens.base.success[500],
  textMuted: colorTokens.base.neutral[500],
  surfaceMuted: colorTokens.base.neutral[100],
  primary: colorTokens.base.primary[500],
} as const;

const SPARKLE = '\u2728';
const HEART_ICON = '\u{1F49A}';
const PLATE_ICON = '\u{1F37D}\uFE0F';

/**
 * Internal component function for memoization
 */
const ImpactMomentComponent = ({
  visible,
  donationAmount,
  totalDonations,
  mealCount,
  onDismiss,
  currency = 'TND',
}: ImpactMomentProps) => {
  const { t } = useTranslation();
  const [heartScale] = useState(() => new Animated.Value(0));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [sparkleAnim] = useState(() => new Animated.Value(0));

  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [fadeAnim, onDismiss]);

  useEffect(() => {
    if (visible) {
      heartScale.setValue(0);
      fadeAnim.setValue(0);
      sparkleAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(heartScale, {
            toValue: 1.2,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(heartScale, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
          }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(sparkleAnim, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(sparkleAnim, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ),
      ]).start();
    }
  }, [visible, heartScale, fadeAnim, sparkleAnim]);

  const sparkleOpacity = useMemo(
    () =>
      sparkleAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 1, 0.3],
      }),
    [sparkleAnim],
  );
  const mealsSummary = `${PLATE_ICON} ${t('donations.mealsSummary', { count: mealCount })} ${PLATE_ICON}`;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType='none' onRequestClose={handleDismiss}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.content}>
          <Animated.Text style={[styles.sparkle, styles.sparkleLeft, { opacity: sparkleOpacity }]}>
            {SPARKLE}
          </Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sparkleRight, { opacity: sparkleOpacity }]}>
            {SPARKLE}
          </Animated.Text>

          <Animated.Text
            style={[
              styles.heartIcon,
              {
                transform: [{ scale: heartScale }],
              },
            ]}
          >
            {HEART_ICON}
          </Animated.Text>

          <Text style={styles.title}>{t('donations.thankYou')}</Text>

          <View style={styles.donationBox}>
            <Text style={styles.label}>{t('donations.youContributed')}</Text>
            <Text style={styles.amount}>
              {donationAmount.toFixed(2)} {currency}
            </Text>
            <Text style={styles.sublabel}>{t('donations.toFeedingSomeone')}</Text>
          </View>

          <View style={styles.statsBox}>
            <Text style={styles.statsLabel}>{t('donations.togetherDonated')}</Text>
            <Text style={styles.statsValue}>
              {totalDonations.toFixed(2)} {currency}
            </Text>
            <Text style={styles.mealsText}>{mealsSummary}</Text>
          </View>

          {/* Stays until the customer closes it. This is the one screen that
              tells them their order fed someone — three seconds was not long
              enough to read the amount, let alone take it in. */}
          <Pressable
            onPress={handleDismiss}
            style={styles.dismissButton}
            accessibilityRole='button'
            accessibilityLabel={t('donations.close')}
            accessibilityHint={t('donations.closeHint')}
          >
            <Text style={styles.dismissButtonText}>{t('donations.close')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.85,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sparkle: {
    fontSize: 40,
    position: 'absolute',
    top: 20,
  },
  sparkleLeft: {
    insetInlineStart: 30,
  },
  sparkleRight: {
    insetInlineEnd: 30,
  },
  heartIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 24,
  },
  donationBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  statsBox: {
    width: '100%',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16,
    padding: sp[5],
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: sp[3],
  },
  mealsText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  dismissButton: {
    marginTop: sp[5],
    alignSelf: 'stretch',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.surface,
  },
});

ImpactMomentComponent.displayName = 'ImpactMoment';
export const ImpactMoment = memo(ImpactMomentComponent);
