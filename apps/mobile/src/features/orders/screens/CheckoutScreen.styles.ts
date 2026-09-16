/**
 * CheckoutScreen palette and styles.
 *
 * Split out of the screen (which was 1202 lines) following the same
 * co-located `*.styles.ts` convention the design system already uses. Moved
 * verbatim — no visual change.
 *
 * The colour constants live here rather than in the screen because the
 * StyleSheet is their main consumer; the screen imports back the handful it
 * needs for inline icon/JSX colours.
 */

import { Platform, StyleSheet } from 'react-native';

import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/*
 * STATUS TINTS ARE DELIBERATELY NOT THEME ROLES - audit M18.
 *
 * The obvious migration is SUCCESS_SURFACE -> c.successContainer,
 * SUCCESS_TEXT -> c.onSuccessContainer and so on. Measured, that trades a
 * hardcoded palette for a token palette that is worse: all four dark
 * on*Container/*Container pairs fail WCAG AA, and light warning and info fail
 * too. Only light success and error pass.
 *
 * These four values stay literal until the status-badge decision in DESIGN.md
 * 2.5 (solid fill instead of tint) is taken app-wide. They are light-only, so
 * they are also the reason this screen is not yet fully dark-ready - recorded
 * rather than papered over.
 *
 * SUCCESS_TEXT was #059669 at 3.6 on SUCCESS_SURFACE - fixed to success[600]
 * (#1B5E20) at 7.53 as part of E25.
 */
const SUCCESS_SURFACE = '#F0FDF4';
const SUCCESS_TINT = '#D1FAE5';
export const SUCCESS_TEXT = colorTokens.base.success[600];
export const WARNING_TEXT = '#92400E';
const ERROR_SURFACE = '#FEF2F2';
export const ERROR_TEXT = '#991B1B';

/**
 * Everything structural comes from the theme.
 *
 * Light values are preserved exactly where a role carries the same value -
 * TEXT_PRIMARY, TEXT_SECONDARY, BORDER_SUBTLE, BRAND_PRIMARY, the status
 * borders. Two move by 5 in RGB, deliberately:
 *
 *   SCREEN_BACKGROUND  #FAFAFA -> c.surfaceVariant #F5F5F5
 *   SURFACE            #FFFFFF -> c.surface        #FAFAFA
 *
 * There is no role whose light value is pure white, so a ground/card pair that
 * survives into dark has to give up one of the two. The driver flow already
 * settled this the same way (ground surfaceVariant, card surface), so Checkout
 * matches it rather than inventing a second convention. A 5-point shift on a
 * near-white is imperceptible; a white card on a dark screen is not.
 */
export const createCheckoutStyles = createThemedStyles((c: ThemePalette) => {
  const SCREEN_BACKGROUND = c.surfaceVariant;
  const SURFACE = c.surface;
  const TEXT_PRIMARY = c.onBackground;
  const TEXT_SECONDARY = c.onSurfaceVariant;
  const TEXT_TERTIARY = c.onSurfaceVariant;
  const BORDER_SUBTLE = c.outlineVariant;
  /*
   * Control boundaries take `outline`, not `outlineVariant`. The delivery-mode
   * and payment-method cards are selectable controls, so WCAG 1.4.11 wants 3:1
   * against the page. Measured on device: outlineVariant (#E0E0E0) gave 1.26
   * on #FAFAFA, while the selected card's success border gave 4.91 - so an
   * unselected option was effectively borderless. See colors.ts, which defines
   * outline as "boundaries that identify a control (must pass 3.0)".
   */
  const BORDER_CONTROL = c.outline;
  const BRAND_PRIMARY = c.primary;
  const SUCCESS_BORDER = c.success;
  const ERROR_BORDER = c.error;
  const WHITE = c.onPrimary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: SCREEN_BACKGROUND,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorTitle: {
      marginTop: 16,
      color: TEXT_PRIMARY,
    },
    errorGoBackButton: {
      marginTop: 24,
    },

    // Main Card
    mainCard: {
      backgroundColor: SURFACE,
      marginHorizontal: 16,
      marginTop: 13,
      borderRadius: 24,
      padding: sp[5],
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: {
          elevation: 4,
        },
      }),
    },

    // Section Styles
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: TEXT_PRIMARY,
      marginStart: 8,
    },

    // Payment Methods — horizontal tile row
    paymentMethodsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    /**
     * Same flex weight as a card, nothing drawn. Keeps a single remaining payment
     * option the same width as the two-up rows around it — a lone `flex: 1` card
     * would otherwise span the whole row and read as a different control.
     */
    paymentMethodCardSpacer: {
      flex: 1,
      flexBasis: 0,
    },
    paymentMethodCard: {
      flex: 1,
      flexBasis: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: BORDER_CONTROL,
      backgroundColor: SURFACE,
      gap: 6,
      position: 'relative',
    },
    paymentMethodCardActive: {
      borderColor: SUCCESS_BORDER,
      borderWidth: 2,
      backgroundColor: SUCCESS_SURFACE,
    },
    paymentCardLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: TEXT_TERTIARY,
      textAlign: 'center',
      lineHeight: 16,
    },
    paymentCardLabelActive: {
      color: BRAND_PRIMARY,
    },
    paymentCardCheck: {
      position: 'absolute',
      top: 6,
      insetInlineEnd: 6,
    },

    // Price Breakdown
    priceBreakdown: {
      backgroundColor: SCREEN_BACKGROUND,
      borderRadius: 16,
      padding: 16,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: sp[3],
    },
    priceLabel: {
      fontSize: 15,
      color: TEXT_SECONDARY,
    },
    priceValue: {
      fontSize: 15,
      fontWeight: '600',
      color: TEXT_TERTIARY,
    },
    savingsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: SUCCESS_TINT,
      borderRadius: 10,
      paddingHorizontal: sp[3],
      paddingVertical: 8,
      marginVertical: 8,
    },
    savingsText: {
      fontSize: 14,
      fontWeight: '600',
      color: SUCCESS_TEXT,
      marginStart: 6,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 16,
      marginTop: sp[3],
      borderTopWidth: 2,
      borderTopColor: BORDER_SUBTLE,
      borderStyle: 'dashed',
    },
    totalLabel: {
      fontSize: 17,
      fontWeight: '700',
      color: TEXT_PRIMARY,
    },
    totalValue: {
      fontSize: 22,
      fontWeight: '800',
      color: BRAND_PRIMARY,
      letterSpacing: -0.5,
    },

    // Divider
    divider: {
      height: 1,
      backgroundColor: BORDER_SUBTLE,
      marginVertical: sp[3],
    },

    // Error Banner
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ERROR_SURFACE,
      borderRadius: 12,
      padding: 14,
      marginBottom: sp[5],
      borderStartWidth: 4,
      borderStartColor: ERROR_BORDER,
    },
    errorText: {
      fontSize: 14,
      color: ERROR_TEXT,
      marginStart: 10,
      flex: 1,
      fontWeight: '500',
    },

    // Buttons
    confirmButtonWrapper: {
      marginTop: 8,
      marginBottom: sp[3],
    },
    confirmButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 24,
      ...Platform.select({
        ios: {
          shadowColor: BRAND_PRIMARY,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: WHITE,
      marginStart: 10,
      letterSpacing: 0.3,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: TEXT_SECONDARY,
    },

    // Map Container
    mapContainer: {
      marginBottom: 16,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: BORDER_SUBTLE,
    },
    mapLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: TEXT_SECONDARY,
      paddingHorizontal: sp[3],
      paddingVertical: 8,
      backgroundColor: SURFACE,
    },
    mapWrapper: {
      height: 200,
      position: 'relative',
    },
    mapPinOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      // paddingBottom = icon size so the pin TIP (bottom of icon) sits at map center
      paddingBottom: 40,
    },
    mapPlaceholder: {
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: SCREEN_BACKGROUND,
    },
    mapPlaceholderText: {
      fontSize: 14,
      color: TEXT_SECONDARY,
    },
    distanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: sp[3],
      paddingVertical: 8,
      backgroundColor: SUCCESS_SURFACE,
    },
    distanceRowError: {
      backgroundColor: ERROR_SURFACE,
    },
    distanceText: {
      fontSize: 13,
      fontWeight: '600',
      color: SUCCESS_TEXT,
    },
  });
});
