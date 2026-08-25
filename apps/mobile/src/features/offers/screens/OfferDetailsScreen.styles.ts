/**
 * OfferDetailsScreen palette and styles.
 *
 * Split out of the screen following the design system's co-located
 * `*.styles.ts` convention. Moved verbatim — no visual change.
 */

import { Dimensions, Platform, StyleSheet } from 'react-native';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PRIMARY_COLOR = colorTokens.base.primary[500];

const SURFACE = '#fff';
const SURFACE_MUTED = '#e5e7eb';
const SURFACE_SUBTLE = '#f3f4f6';
const SURFACE_SOFT = '#eafaf8';
const SURFACE_OVERLAY = 'rgba(255,255,255,0.9)';
const BACKDROP = 'rgba(0,0,0,0.6)';
const SHADOW = '#000';
const TEXT_PRIMARY = '#111827';
const TEXT_MUTED = '#4b5563';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
export const WHITE = '#fff';
export const INDIGO = '#6366f1';
const TEAL = '#0f766e';
const SUCCESS_BORDER = '#a7f3d0';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  retryButton: { marginTop: sp[5] },
  scrollContent: { paddingBottom: 0 },
  headerContainer: { height: 280, width: '100%', position: 'relative' },
  headerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  topNav: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    insetInlineStart: 16,
    insetInlineEnd: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightActions: { flexDirection: 'row' },
  merchantLogoContainer: {
    position: 'absolute',
    bottom: 20,
    insetInlineStart: 20,
    zIndex: 5,
  },
  merchantLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE,
    borderWidth: 3,
    borderColor: SURFACE,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  merchantLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: INDIGO,
    borderWidth: 3,
    borderColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  logoPlaceholderText: { color: WHITE, fontSize: 16 },
  headerTextContainer: {
    position: 'absolute',
    bottom: 20,
    insetInlineStart: 90,
    insetInlineEnd: 20,
  },
  headerTitleText: { color: WHITE },
  headerSubtitleText: { color: SURFACE_MUTED },
  contentContainer: { paddingHorizontal: sp[5], paddingTop: 24 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center' },
  offerTypeText: { marginStart: sp[3] },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { textDecorationLine: 'line-through' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  ratingText: { color: TEXT_PRIMARY },
  reviewCount: { color: TEXT_TERTIARY },
  pickupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  pickupText: { fontSize: 15, color: TEXT_MUTED, marginStart: 8, marginEnd: 8 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  todayBadgeText: { color: WHITE, fontSize: 10 },
  slotLimitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  slotLimitText: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '500' },
  locationCard: {
    marginTop: 24,
    backgroundColor: SURFACE_SOFT,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationContent: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 16 },
  locationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  locationTextContainer: { flex: 1, justifyContent: 'center' },
  locationAddress: {
    color: TEAL,
    fontSize: 15,
    lineHeight: 20,
  },
  locationSubtext: { marginTop: 2, fontWeight: '300' },
  divider: { height: 1, backgroundColor: SURFACE_SUBTLE, marginVertical: 24 },
  section: { marginVertical: 8 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionContent: { marginTop: sp[3] },
  nutritionSection: { marginBottom: 0 },
  descriptionText: { lineHeight: 22 },
  nutritionHeading: { color: TEXT_PRIMARY },
  nutritionBody: { lineHeight: 20, marginTop: 4 },
  nutritionSectionSpaced: { marginTop: 16 },
  dietaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  dietaryTag: {
    backgroundColor: SURFACE_SOFT,
    paddingHorizontal: sp[3],
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
  },
  dietaryTagText: { color: TEAL },
  footerSpacer: { height: 120 },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: SURFACE,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerInfo: { flex: 1, marginEnd: 16 },
  reserveButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  reserveButtonText: { color: WHITE },

  // ✅ BEST PRACTICE: Custom overlay (not Modal) - naturally respects navigation boundaries
  // Renders within screen container, backdrop starts from screen content (below header)
  modalOverlay: {
    ...StyleSheet.absoluteFillObject, // Covers entire screen content
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject, // Covers entire screen content area
    backgroundColor: BACKDROP,
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.85, // 85% of screen height
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    padding: sp[5],
    paddingBottom: 16,
    alignItems: 'center',
  },
  modalHeaderTitle: { color: WHITE, fontSize: 18 },
  modalHeaderSubtitle: { color: SURFACE_MUTED, marginTop: 4 },
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  modalTimeText: { color: WHITE, marginStart: 6 },
  modalBody: { padding: 24, paddingTop: 16 },
  quantityLabel: { marginBottom: 16 },
  quantityControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginVertical: 10,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  reserveButtonSpacing: { marginTop: 24 },
  termsContainer: {
    marginTop: sp[5],
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  termsText: { lineHeight: 18 },
  termsLink: { textDecorationLine: 'underline' },
  modalDivider: { height: 1, backgroundColor: SURFACE_MUTED, marginVertical: sp[5] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
