import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, I18nManager, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import LeafLogo from '@/assets/images/leaf-logo.svg';
import ShapesIcon from '@/assets/images/shapes.svg';
import { colorTokens } from '@/design-system/tokens/colors';
import { onboardingStorage } from '@/storage/onboardingStorage';

import type { WelcomeScreenNavigationProp } from '@/navigation/types';

const { width: RAW_W, height: RAW_H } = Dimensions.get('window');

const W = Math.max(320, Math.min(RAW_W, 430));
const H = Math.max(640, Math.min(RAW_H, 960));
const REAL_W = RAW_W;

const sw = (n: number) => Math.round((n * W) / 390);
const sh = (n: number) => Math.round((n * H) / 844);

const PRIMARY = colorTokens.base.primary[500];
const ACCENT = colorTokens.base.accent[300];
const WHITE = '#FFFFFF';

const IS_LANDSCAPE = RAW_W > RAW_H;

const FOOD_IMG = require('@/assets/images/boal.webp');

const FOOD_SIZE = IS_LANDSCAPE ? sw(220) : sw(265);

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsNavigating(false);
    });
    return unsubscribe;
  }, [navigation]);

  const handleSkip = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    onboardingStorage.markWelcomeSeen();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [navigation, isNavigating]);

  const handleGetStarted = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    navigation.navigate('Onboarding2');
  }, [navigation, isNavigating]);

  return (
    <View style={styles.container}>
      {/* ── Top bar: logo + skip ── */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <LeafLogo width={sw(36)} height={sw(36)} />
          <Text style={styles.logoName}>{t('common.appName')}</Text>
        </View>
        <Pressable
          onPress={handleSkip}
          disabled={isNavigating}
          accessibilityRole='button'
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>{t('welcome.skip')}</Text>
        </Pressable>
      </View>

      {/* ── Headline ── */}
      <View style={styles.headline}>
        <Text style={styles.headlineLine}>{t('welcome.headline.line1')}</Text>
        <Text style={[styles.headlineLine, styles.headlineAccent]}>
          {t('welcome.headline.line2')}
        </Text>
        <Text style={styles.headlineLine}>{t('welcome.headline.line3')}</Text>
      </View>

      {/* ── Body text ── */}
      <Text style={styles.bodyText}>{t('welcome.bodyText')}</Text>

      {/* ── Food bowl + doodle ── */}
      <View style={IS_LANDSCAPE ? styles.foodGroupLandscape : styles.foodGroup}>
        <View style={styles.foodWrap}>
          <Image
            source={FOOD_IMG}
            style={styles.foodImage}
            resizeMode='cover'
            accessibilityLabel={t('welcome.bodyText')}
            accessibilityHint={t('welcome.headline.line1')}
            accessibilityIgnoresInvertColors
          />
        </View>
        <ShapesIcon
          width={sw(100)}
          height={sw(67)}
          style={[styles.shapesDecor, I18nManager.isRTL && styles.shapesRTL]}
        />
      </View>

      {/* ── Get Started button ── */}
      <View style={styles.getStartedWrap}>
        <Pressable
          style={({ pressed }) => [styles.getStartedBtn, pressed && { opacity: 0.85 }]}
          onPress={handleGetStarted}
          disabled={isNavigating}
          accessibilityRole='button'
          testID='welcome-get-started-button'
        >
          <Text style={styles.getStartedText}>{t('welcome.getStarted')}</Text>
        </Pressable>
      </View>

      {/* ── Bottom nav: dots ── */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
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
    left: sw(16),
    right: sw(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  logoName: {
    fontSize: sw(16),
    fontWeight: '700',
    color: WHITE,
    letterSpacing: -0.2,
  },
  skipText: {
    fontSize: sw(14),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // ── Headline ──
  headline: {
    position: 'absolute',
    top: sh(110),
    left: sw(20),
    right: sw(18),
    zIndex: 10,
  },
  headlineLine: {
    fontFamily: 'BebasNeue-Regular',
    fontSize: sw(56),
    fontWeight: '400',
    letterSpacing: sw(1.5),
    lineHeight: sw(62),
    color: WHITE,
  },
  headlineAccent: {
    color: ACCENT,
  },

  // ── Body text ──
  bodyText: {
    position: 'absolute',
    top: sh(358),
    left: sw(24),
    width: sw(190),
    fontSize: sw(14),
    color: 'rgba(255,255,255,0.8)',
    lineHeight: sw(22),
    fontWeight: '400',
    zIndex: 10,
  },

  // ── Food photo ──
  foodGroup: {
    position: 'absolute',
    bottom: sh(150),
    left: (REAL_W - FOOD_SIZE) / 2,
    width: FOOD_SIZE,
    height: FOOD_SIZE,
    zIndex: 5,
  },
  foodGroupLandscape: {
    position: 'absolute',
    top: sh(60),
    right: REAL_W * 0.55,
    width: FOOD_SIZE,
    height: FOOD_SIZE,
    zIndex: 5,
  },
  foodWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FOOD_SIZE,
    height: FOOD_SIZE,
    borderRadius: FOOD_SIZE / 2,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  shapesDecor: {
    position: 'absolute',
    top: sw(20),
    right: -sw(28),
    transform: [{ rotate: '10deg' }],
  },
  shapesRTL: {
    transform: [{ rotate: '-10deg' }, { scaleX: -1 }],
  },

  // ── Get Started ──
  getStartedWrap: {
    position: 'absolute',
    bottom: sh(100),
    left: sw(24),
    right: sw(24),
    zIndex: 20,
  },
  getStartedBtn: {
    backgroundColor: ACCENT,
    borderRadius: sw(28),
    paddingVertical: sh(16),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  getStartedText: {
    color: WHITE,
    fontSize: sw(17),
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Bottom nav ──
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: sh(42),
    zIndex: 20,
    alignItems: 'center',
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
