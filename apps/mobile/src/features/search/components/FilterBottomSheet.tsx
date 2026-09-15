/**
 * Filter Bottom Sheet
 *
 * Beautiful, modern filter UI with:
 * - Animated bottom sheet
 * - Flag chips for cuisines
 * - Category pills
 * - Price range slider
 * - Live result count
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { CATEGORY_OPTIONS, OFFER_TYPE_OPTIONS } from '../constants/filterOptions';

import type { FilterState } from '../types/filter.types';
import type { OfferType } from '@/features/offers/types/offer.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHITE = '#FFFFFF';
const OVERLAY = 'rgba(0, 0, 0, 0.5)';
const SHEET_SHADOW = '#000';

// ============================================================================
// Props
// ============================================================================

interface FilterBottomSheetProps {
  visible: boolean;
  filters: FilterState;
  resultCount?: number;
  isLoading?: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  visible,
  filters: initialFilters,
  resultCount,
  isLoading = false,
  onClose,
  onApply,
  onClear,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [localFilters, setLocalFilters] = useState<FilterState>(initialFilters);
  const accentTextStyle = { color: colors.accent };
  const onSurfaceTextStyle = { color: colors.onSurface };
  const primaryTextStyle = { color: colors.primary };

  // Sync local state when initial filters change
  useEffect(() => {
    setLocalFilters(initialFilters);
  }, [initialFilters]);

  // ──────────────────────────────────────────────────────────────────────────
  // Filter Handlers
  // ──────────────────────────────────────────────────────────────────────────

  const toggleOfferType = useCallback((type: OfferType | null) => {
    setLocalFilters(prev => ({
      ...prev,
      offerType: prev.offerType === type ? null : type,
    }));
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setLocalFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  /*
   * Still clears establishmentTypes, even though this sheet no longer shows
   * them. "Clear" has to mean all filters: the rail's selection is visible on
   * the screen behind the sheet, so leaving it set after a Clear would read as
   * the button not working.
   */
  const handleClear = useCallback(() => {
    setLocalFilters({
      offerType: null,
      establishmentTypes: [],
      cuisineTypes: [],
      categories: [],
      priceRange: { min: null, max: null },
      minDiscount: null,
    });
    onClear();
  }, [onClear]);

  const handleApply = useCallback(() => {
    onApply(localFilters);
    onClose();
  }, [localFilters, onApply, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityRole='button' style={styles.backdrop} onPress={onClose} />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={t('search.a11yCloseFilters')}
            accessibilityHint={t('common.a11yCloseModalHint')}
            onPress={onClose}
            style={styles.closeButton}
            // 32x32 box + 6px each side = the 44x44 minimum touch target.
            hitSlop={6}
          >
            <Icon name='close' size={24} color={colors.onSurface} />
          </Pressable>
          <Text variant='headline' style={styles.headerTitle}>
            Filters
          </Text>
          <Pressable accessibilityRole='button' onPress={handleClear}>
            <Text variant='body' style={accentTextStyle}>
              Clear
            </Text>
          </Pressable>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Offer Type Section */}
          <View style={styles.section}>
            <Text variant='title' style={[styles.sectionTitle, { color: colors.onSurface }]}>
              🎁 Offer Type
            </Text>
            <View style={styles.radioGroup}>
              {OFFER_TYPE_OPTIONS.map(option => {
                const isSelected = localFilters.offerType === option.value;
                return (
                  <Pressable
                    accessibilityRole='button'
                    key={option.label}
                    style={[
                      styles.radioChip,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.outline,
                      },
                    ]}
                    onPress={() => toggleOfferType(option.value)}
                  >
                    <Text style={styles.offerTypeIcon}>{option.icon}</Text>
                    <Text
                      variant='body'
                      style={[
                        styles.optionLabel,
                        isSelected ? styles.selectedText : onSurfaceTextStyle,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Food Categories Section */}
          <View style={styles.section}>
            <Text variant='title' style={[styles.sectionTitle, { color: colors.onSurface }]}>
              🍕 Food Categories
            </Text>
            <View style={styles.chipWrap}>
              {CATEGORY_OPTIONS.map(option => {
                const isSelected = localFilters.categories.includes(option.value);
                return (
                  <Pressable
                    accessibilityRole='button'
                    key={option.value}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.outline,
                      },
                    ]}
                    onPress={() => toggleCategory(option.value)}
                  >
                    {option.icon && <Text style={styles.categoryIcon}>{option.icon}</Text>}
                    <Text
                      variant='caption'
                      style={[
                        styles.optionLabel,
                        isSelected ? styles.selectedText : onSurfaceTextStyle,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, { borderTopColor: colors.outlineVariant }]}>
          <Pressable
            accessibilityRole='button'
            style={[styles.applyButton, { backgroundColor: colors.primary }]}
            onPress={handleApply}
          >
            {isLoading ? (
              <ActivityIndicator color='#FFFFFF' />
            ) : (
              <>
                <Text variant='label' weight='semibold' style={styles.applyButtonText}>
                  Apply Filters
                </Text>
                {resultCount !== undefined && (
                  <View style={styles.resultBadge}>
                    <Text variant='caption' style={[styles.resultBadgeText, primaryTextStyle]}>
                      {resultCount}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: OVERLAY,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: SHEET_SHADOW,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp[5],
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: sp[5],
    paddingTop: 24,
  },
  sectionTitle: {
    marginBottom: sp[3],
    fontWeight: '600',
  },
  radioGroup: {
    gap: 10,
  },
  radioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  offerTypeIcon: {
    fontSize: 18,
    marginEnd: 6,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconChip: {
    width: (SCREEN_WIDTH - 60) / 4,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    padding: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
  },
  categoryIcon: {
    fontSize: 16,
    marginEnd: 4,
  },
  optionLabel: {
    fontSize: 14,
  },
  selectedText: {
    color: WHITE,
  },
  footer: {
    paddingHorizontal: sp[5],
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  resultBadge: {
    backgroundColor: WHITE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  applyButtonText: {
    color: WHITE,
  },
  resultBadgeText: {
    fontWeight: '600',
  },
});
