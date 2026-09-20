import React from 'react';
import { isAppRTL } from '@/i18n/direction';
import { useTranslation } from 'react-i18next';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import ShapesIcon from '@/assets/images/shapes.svg';
import { colorTokens } from '@/design-system/tokens/colors';

const { width: RAW_W, height: RAW_H } = Dimensions.get('window');

const W = Math.max(320, Math.min(RAW_W, 430));
const H = Math.max(640, Math.min(RAW_H, 960));

const sw = (n: number) => Math.round((n * W) / 390);
const sh = (n: number) => Math.round((n * H) / 844);

const ACCENT = colorTokens.base.accent[300]; // #F04535
const WHITE = '#FFFFFF';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SCENE_IMG = require('@/assets/images/bag-wall.webp');

interface OnboardingPageThreeProps {
  /** Return to page 2. */
  onPrevious: () => void;
  /** Leave onboarding for the registration form. */
  onCreateAccount: () => void;
  /** True once a terminal action has fired, so it cannot fire twice. */
  isLeaving: boolean;
}

export const OnboardingPageThree: React.FC<OnboardingPageThreeProps> = ({
  onPrevious,
  onCreateAccount,
  isLeaving,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Full-screen scene: wall + floor + bag + shadow */}
      <Image
        source={SCENE_IMG}
        style={styles.sceneBg}
        resizeMode='cover'
        accessibilityLabel={t('auth.a11yOnboardingImage')}
        accessibilityHint={t('auth.a11yOnboardingImageHint')}
        accessibilityIgnoresInvertColors
      />

      {/* Headline */}
      <View style={styles.headline}>
        <Text style={[styles.headlineLine, styles.headlineWhite]}>
          {t('onboarding3.headline1')}
        </Text>
        <Text style={[styles.headlineLine, styles.headlineWhite]}>
          {t('onboarding3.headline2')}
        </Text>
        <Text style={[styles.headlineLine, styles.headlineCoral]}>
          {t('onboarding3.headline3')}
        </Text>
      </View>

      {/* Body text */}
      <Text style={styles.bodyText}>{t('onboarding3.bodyText')}</Text>

      {/* Shapes decoration */}
      <ShapesIcon
        width={sw(90)}
        height={sw(60)}
        style={[styles.shapesDecor, isAppRTL() && styles.shapesRTL]}
      />

      {/* Bottom: back arrow + create account + dots */}
      <View style={styles.bottom}>
        <Pressable
          style={({ pressed }) => [
            styles.btnCreate,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          onPress={onCreateAccount}
          disabled={isLeaving}
          accessibilityRole='button'
          testID='onboarding3-create-account'
        >
          <Text style={styles.btnCreateText}>{t('onboarding3.createAccount')}</Text>
        </Pressable>

        <View style={styles.navRow}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
            onPress={onPrevious}
            accessibilityRole='button'
            accessibilityLabel={t('common.back')}
            accessibilityHint={t('auth.a11yPreviousOnboarding')}
          >
            {/*
              A vector icon is content, not layout, so RN does not flip it the
              way it flips the row around it. In Arabic this button sits on the
              right and "back" points right. The ‹ › glyphs on page 2 need no
              such handling — they are text, and the bidi renderer mirrors them.
            */}
            <Icon name={isAppRTL() ? 'arrow-forward' : 'arrow-back'} size={sw(22)} color={WHITE} />
          </Pressable>

          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>

          <View style={styles.backBtnSpacer} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1E22',
  },

  // Full-screen background scene
  sceneBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RAW_W,
    height: RAW_H,
  },

  // Headline
  headline: {
    position: 'absolute',
    top: sh(70),
    left: sw(24),
    right: sw(24),
    zIndex: 10,
  },
  headlineLine: {
    fontFamily: 'BebasNeue-Regular',
    fontSize: sw(42),
    fontWeight: '400',
    letterSpacing: sw(1.5),
    lineHeight: sw(48),
    textTransform: 'uppercase',
  },
  headlineWhite: {
    color: WHITE,
  },
  headlineCoral: {
    color: ACCENT,
  },

  // Body text
  bodyText: {
    position: 'absolute',
    top: sh(230),
    insetInlineStart: sw(24),
    width: sw(195),
    fontSize: sw(14.5),
    color: 'rgba(255,255,255,0.65)',
    lineHeight: sw(14.5 * 1.58),
    fontWeight: '400',
    zIndex: 10,
  },

  // Shapes decoration
  shapesDecor: {
    position: 'absolute',
    top: sh(265),
    right: sw(18),
    zIndex: 8,
    transform: [{ rotate: '12deg' }],
    opacity: 0.95,
  },
  shapesRTL: {
    right: sw(50),
    transform: [{ rotate: '-12deg' }, { scaleX: -1 }],
  },

  // Bottom
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: sw(24),
    paddingBottom: sh(38),
    zIndex: 20,
    alignItems: 'center',
  },
  btnCreate: {
    width: '100%',
    backgroundColor: ACCENT,
    borderRadius: sw(50),
    paddingVertical: sh(17),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sh(12),
    elevation: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
  },
  btnCreateText: {
    color: WHITE,
    fontSize: sw(17),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: sh(14),
  },
  backBtn: {
    width: sw(44),
    height: sw(44),
    borderRadius: sw(22),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: {
    width: sw(44),
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
