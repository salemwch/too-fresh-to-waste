import React from 'react';
import { isAppRTL } from '@/i18n/direction';
import { useTranslation } from 'react-i18next';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LeafLogo from '@/assets/images/leaf-logo.svg';
import ShapesIcon from '@/assets/images/shapes.svg';
import { colorTokens } from '@/design-system/tokens/colors';

import FOOD_IMG from '@/assets/images/boal.webp';

const { width: RAW_W, height: RAW_H } = Dimensions.get('window');

const W = Math.max(320, Math.min(RAW_W, 430));
const H = Math.max(640, Math.min(RAW_H, 960));

const sw = (n: number) => Math.round((n * W) / 390);
const sh = (n: number) => Math.round((n * H) / 844);

const PRIMARY = colorTokens.base.primary[500];
const ACCENT = colorTokens.base.accent[300];
const WHITE = '#FFFFFF';

/**
 * The bowl's maximum size. It is a maximum, not a size: the bowl sits in a
 * flexible box and shrinks to whatever the headline leaves behind, which is
 * what keeps the screen whole in French and in landscape. See the layout note
 * on `styles.textBlock`.
 */
const FOOD_MAX_SIZE = sw(265);

interface OnboardingPageOneProps {
  /** Advance to page 2. Owned by the pager, not by this page. */
  onNext: () => void;
  /** Leave onboarding for the login screen. */
  onSkip: () => void;
  /** True once a terminal action has fired, so it cannot fire twice. */
  isLeaving: boolean;
}

export const OnboardingPageOne: React.FC<OnboardingPageOneProps> = ({
  onNext,
  onSkip,
  isLeaving,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + sh(14) }]}>
      {/* ── Top bar: logo + skip ── */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <LeafLogo width={sw(36)} height={sw(36)} />
          <Text style={styles.logoName}>{t('common.appName')}</Text>
        </View>
        <Pressable
          onPress={onSkip}
          disabled={isLeaving}
          accessibilityRole='button'
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>{t('welcome.skip')}</Text>
        </Pressable>
      </View>

      {/* ── Headline + body ── */}
      <View style={styles.textBlock}>
        <Text style={styles.headlineLine}>{t('welcome.headline.line1')}</Text>
        <Text style={[styles.headlineLine, styles.headlineAccent]}>
          {t('welcome.headline.line2')}
        </Text>
        <Text style={styles.headlineLine}>{t('welcome.headline.line3')}</Text>
        <Text style={styles.bodyText}>{t('welcome.bodyText')}</Text>
      </View>

      {/* ── Food bowl + doodle ── */}
      <View style={styles.foodGroup}>
        <View style={styles.bowlBox}>
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
            style={[styles.shapesDecor, isAppRTL() && styles.shapesRTL]}
          />
        </View>
      </View>

      {/* ── Get Started button + dots ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + sh(42) }]}>
        <Pressable
          style={({ pressed }) => [styles.getStartedBtn, pressed && styles.pressed]}
          onPress={onNext}
          disabled={isLeaving}
          accessibilityRole='button'
          testID='welcome-get-started-button'
        >
          <Text style={styles.getStartedText}>{t('welcome.getStarted')}</Text>
        </Pressable>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: sw(16),
    paddingEnd: sw(24),
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

  /*
   * Headline and body are ONE block in normal flow, and everything below them
   * is flexible.
   *
   * They used to be two independently `position: 'absolute'` boxes pinned at
   * top 110 and top 358, which holds only while the headline is exactly three
   * lines. It is three lines in English. In French "SAUVEZ LA NOURRITURE" wraps,
   * the headline becomes four, and the fourth line was drawn straight through
   * "Des aliments délicieux…" — measured on a 720x1280 device, a ~40px overlap.
   * Arabic and any larger system font size fail the same way.
   */
  textBlock: {
    paddingStart: sw(20),
    paddingEnd: sw(18),
    marginTop: sh(22),
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
  bodyText: {
    marginTop: sh(18),
    width: sw(190),
    fontSize: sw(14),
    color: 'rgba(255,255,255,0.8)',
    lineHeight: sw(22),
    fontWeight: '400',
  },

  /*
   * The bowl takes the room the text did not. `flex: 1` + `aspectRatio: 1`
   * keeps it circular while it shrinks, and `maxHeight` stops it growing past
   * its designed size on a tall screen. This is also what makes landscape work
   * without a second set of styles — the old landscape branch read `Dimensions`
   * once at module load, so it was wrong for anyone who rotated the device.
   */
  /*
   * No `minHeight`: the bowl is the first thing that gives. At a 2x system
   * font scale the headline alone is taller than the screen, and the order the
   * space is surrendered in decides what the user loses — a smaller bowl, or
   * the "Get Started" button pushed off the bottom.
   */
  foodGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    /*
     * Clips nothing at normal size — the doodle sits well inside this box —
     * but once the bowl is squeezed to nothing the doodle would otherwise
     * spill out under the CTA as a stray red sliver. Measured at 1.45x.
     */
    overflow: 'hidden',
  },
  bowlBox: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: FOOD_MAX_SIZE,
    maxWidth: '100%',
  },
  foodWrap: {
    flex: 1,
    borderRadius: FOOD_MAX_SIZE / 2,
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

  // ── Footer: CTA + dots ──
  footer: {
    paddingHorizontal: sw(24),
    paddingTop: sh(18),
    alignItems: 'center',
  },
  getStartedBtn: {
    width: '100%',
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
  pressed: {
    opacity: 0.85,
  },
  getStartedText: {
    color: WHITE,
    fontSize: sw(17),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    marginTop: sh(26),
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
