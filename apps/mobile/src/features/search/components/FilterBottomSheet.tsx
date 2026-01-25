/**
 * Filter Bottom Sheet
 *
 * Beautiful, modern filter UI with:
 * - Animated bottom sheet
 * - Icon chips for establishment types
 * - Flag chips for cuisines
 * - Category pills
 * - Price range slider
 * - Live result count
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import type { FilterState } from '../types/filter.types';
import {
  ESTABLISHMENT_TYPE_OPTIONS,
  CUISINE_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  OFFER_TYPE_OPTIONS,
} from '../constants/filterOptions';
import type { EstablishmentType, OfferType } from '@/features/offers/types/offer.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { colors, spacing } = useTheme();
  const [localFilters, setLocalFilters] = useState<FilterState>(initialFilters);

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

  const toggleEstablishmentType = useCallback((type: EstablishmentType) => {
    setLocalFilters(prev => ({
      ...prev,
      establishmentTypes: prev.establishmentTypes.includes(type)
        ? prev.establishmentTypes.filter(t => t !== type)
        : [...prev.establishmentTypes, type],
    }));
  }, []);

  const toggleCuisineType = useCallback((cuisine: string) => {
    setLocalFilters(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes.includes(cuisine)
        ? prev.cuisineTypes.filter(c => c !== cuisine)
        : [...prev.cuisineTypes, cuisine],
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
  }, [localFilters, onApply]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render Helpers
  // ──────────────────────────────────────────────────────────────────────────

  const hasActiveFilters = useMemo(() => {
    return (
      localFilters.offerType !== null ||
      localFilters.establishmentTypes.length > 0 ||
      localFilters.cuisineTypes.length > 0 ||
      localFilters.categories.length > 0
    );
  }, [localFilters]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text variant="h3" style={styles.headerTitle}>
            Filters
          </Text>
          <TouchableOpacity onPress={handleClear}>
            <Text variant="body" style={{ color: colors.accent }}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Offer Type Section */}
          <View style={styles.section}>
            <Text variant="h4" style={[styles.sectionTitle, { color: colors.onSurface }]}>
              🎁 Offer Type
            </Text>
            <View style={styles.radioGroup}>
              {OFFER_TYPE_OPTIONS.map(option => {
                const isSelected = localFilters.offerType === option.value;
                return (
                  <TouchableOpacity
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
                    <Text style={{ fontSize: 18, marginRight: 6 }}>{option.icon}</Text>
                    <Text
                      variant="body"
                      style={{ color: isSelected ? '#FFFFFF' : colors.onSurface }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Establishment Type Section */}
          <View style={styles.section}>
            <Text variant="h4" style={[styles.sectionTitle, { color: colors.onSurface }]}>
              🏪 Establishment Type
            </Text>
            <View style={styles.chipGrid}>
              {ESTABLISHMENT_TYPE_OPTIONS.map(option => {
                const isSelected = localFilters.establishmentTypes.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.iconChip,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.outline,
                      },
                    ]}
                    onPress={() => toggleEstablishmentType(option.value)}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{option.icon}</Text>
                    <Text
                      variant="caption"
                      style={{
                        color: isSelected ? '#FFFFFF' : colors.onSurface,
                        fontSize: 11,
                        textAlign: 'center',
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Cuisine Type Section */}
          <View style={styles.section}>
            <Text variant="h4" style={[styles.sectionTitle, { color: colors.onSurface }]}>
              🍝 Cuisine Type
            </Text>
            <View style={styles.chipGrid}>
              {CUISINE_TYPE_OPTIONS.map(option => {
                const isSelected = localFilters.cuisineTypes.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.flagChip,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.outline,
                      },
                    ]}
                    onPress={() => toggleCuisineType(option.value)}
                  >
                    <Text style={{ fontSize: 20, marginRight: 6 }}>{option.flag}</Text>
                    <Text
                      variant="caption"
                      style={{
                        color: isSelected ? '#FFFFFF' : colors.onSurface,
                        fontSize: 12,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Food Categories Section */}
          <View style={styles.section}>
            <Text variant="h4" style={[styles.sectionTitle, { color: colors.onSurface }]}>
              🍕 Food Categories
            </Text>
            <View style={styles.chipWrap}>
              {CATEGORY_OPTIONS.map(option => {
                const isSelected = localFilters.categories.includes(option.value);
                return (
                  <TouchableOpacity
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
                    {option.icon && (
                      <Text style={{ fontSize: 16, marginRight: 4 }}>{option.icon}</Text>
                    )}
                    <Text
                      variant="caption"
                      style={{ color: isSelected ? '#FFFFFF' : colors.onSurface }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, { borderTopColor: colors.outline }]}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              { backgroundColor: colors.success },
            ]}
            onPress={handleApply}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text variant="button" style={{ color: '#FFFFFF' }}>
                  Apply Filters
                </Text>
                {resultCount !== undefined && (
                  <View style={styles.resultBadge}>
                    <Text variant="caption" style={{ color: colors.success, fontWeight: '600' }}>
                      {resultCount}
                    </Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    marginBottom: 12,
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
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 8,
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
  footer: {
    paddingHorizontal: 20,
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
