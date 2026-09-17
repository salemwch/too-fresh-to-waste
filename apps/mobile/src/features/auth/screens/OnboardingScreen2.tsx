import React, { useCallback, useEffect, useState } from 'react';
import { isAppRTL } from '@/i18n/direction';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import ShapesIcon from '@/assets/images/shapes.svg';
import { colorTokens } from '@/design-system/tokens/colors';
import { onboardingStorage } from '@/storage/onboardingStorage';

import type { Onboarding2ScreenNavigationProp } from '@/navigation/types';

const { width: RAW_W, height: RAW_H } = Dimensions.get('window');

const W = Math.max(320, Math.min(RAW_W, 430));
const H = Math.max(640, Math.min(RAW_H, 960));

const sw = (n: number) => Math.round((n * W) / 390);
const sh = (n: number) => Math.round((n * H) / 844);

const PRIMARY = colorTokens.base.primary[500]; // #1E4448
const PRIMARY_DARK = colorTokens.base.primary[700]; // #112528
const ACCENT = colorTokens.base.accent[300]; // #F04535
const WHITE = '#FFFFFF';

const CIRCLE_SIZE = sw(90);
const NAV_BTN_SIZE = sw(52);

interface Props {
  navigation: Onboarding2ScreenNavigationProp;
}

export const OnboardingScreen2: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsNavigating(false);
    });
    return unsubscribe;
  }, [navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSkip = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    onboardingStorage.markWelcomeSeen();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [navigation, isNavigating]);

  const handleNext = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    navigation.navigate('Onboarding3');
  }, [navigation, isNavigating]);

  return (
    <View style={styles.container}>
      {/* ── Top bar: skip ── */}
      <View style={styles.topBar}>
        <View />
        <Pressable
          onPress={handleSkip}
          disabled={isNavigating}
          accessibilityRole='button'
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>{t('welcome.skip')}</Text>
        </Pressable>
      </View>

      {/* ── Feature rows ── */}
      <View style={styles.content}>
        {/* SAVE MONEY */}
        <View style={styles.featureRow}>
          <View style={styles.circleWrapper}>
            <View style={[styles.circle, { backgroundColor: ACCENT }]}>
              <Icon name='storefront' size={sw(42)} color={WHITE} />
            </View>
            <ShapesIcon
              width={sw(80)}
              height={sw(53)}
              style={[styles.shapesDecor, isAppRTL() && styles.shapesRTL]}
            />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t('onboarding2.saveMoney')}</Text>
            <Text style={styles.featureDesc}>{t('onboarding2.saveMoneyDesc')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* REDUCE WASTE */}
        <View style={styles.featureRow}>
          <View style={[styles.circle, { backgroundColor: PRIMARY_DARK }]}>
            <Icon name='leaf' size={sw(42)} color={WHITE} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t('onboarding2.reduceWaste')}</Text>
            <Text style={styles.featureDesc}>{t('onboarding2.reduceWasteDesc')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* EARN PRIZES */}
        <View style={styles.featureRow}>
          <View style={[styles.circle, { backgroundColor: ACCENT }]}>
            <Icon name='trophy' size={sw(42)} color={WHITE} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t('onboarding2.earnPrizes')}</Text>
            <Text style={styles.featureDesc}>{t('onboarding2.earnPrizesDesc')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* MAKE IMPACT */}
        <View style={styles.featureRow}>
          <View style={[styles.circle, { backgroundColor: PRIMARY_DARK }]}>
            <Icon name='globe-outline' size={sw(42)} color={WHITE} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t('onboarding2.makeImpact')}</Text>
            <Text style={styles.featureDesc}>{t('onboarding2.makeImpactDesc')}</Text>
          </View>
        </View>
      </View>

      {/* ── Bottom: nav ── */}
      <View style={styles.bottom}>
        <View style={styles.navRow}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8 }]}
            onPress={handleBack}
            accessibilityRole='button'
            accessibilityLabel={t('common.back')}
            accessibilityHint={t('auth.a11yPreviousOnboarding')}
          >
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>

          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8 }]}
            onPress={handleNext}
            disabled={isNavigating}
            accessibilityRole='button'
            accessibilityLabel={t('common.next')}
            accessibilityHint={t('auth.a11yGoToLogin')}
          >
            <Text style={[styles.navArrow, styles.navArrowRight]}>›</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: sh(54),
    left: sw(24),
    right: sw(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  skipText: {
    fontSize: sw(14),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // ── Feature rows ──
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: sh(100),
    paddingBottom: sh(10),
    paddingHorizontal: sw(24),
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(18),
    paddingVertical: sh(16),
  },
  circleWrapper: {
    position: 'relative',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapesDecor: {
    position: 'absolute',
    top: -sw(40),
    right: -sw(30),
    transform: [{ rotate: '15deg' }],
  },
  shapesRTL: {
    transform: [{ rotate: '-15deg' }, { scaleX: -1 }],
  },
  featureText: {
    flex: 1,
    gap: sh(4),
  },
  featureTitle: {
    fontFamily: 'BebasNeue-Regular',
    fontSize: sw(26),
    fontWeight: '400',
    letterSpacing: sw(0.5),
    color: WHITE,
  },
  featureDesc: {
    fontSize: sw(14),
    color: 'rgba(255,255,255,0.65)',
    lineHeight: sw(20),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginStart: CIRCLE_SIZE + sw(18),
    marginEnd: sw(4),
  },

  // ── Bottom ──
  bottom: {
    paddingHorizontal: sw(24),
    paddingBottom: sh(42),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: NAV_BTN_SIZE,
    height: NAV_BTN_SIZE,
    borderRadius: NAV_BTN_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    color: WHITE,
    fontSize: sw(28),
    fontWeight: '700',
    lineHeight: sw(34),
    marginEnd: sw(3),
  },
  navArrowRight: {
    marginEnd: 0,
    marginStart: sw(3),
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
});
