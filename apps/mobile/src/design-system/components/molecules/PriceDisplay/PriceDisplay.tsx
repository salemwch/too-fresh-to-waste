/**
 * PriceDisplay Molecule
 * Production-ready price display with currency formatting and savings calculation
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../providers';
import { Text } from '../../atoms/Text';

import type { PriceDisplayProps } from './PriceDisplay.types';
import type { TypographyVariant } from '../../../types';
import type { TextStyle, ViewStyle } from 'react-native';

// Default currency symbols by currency code
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  TND: 'د.ت',
  MAD: 'DH',
  DZD: 'دج',
  JPY: '¥',
  CNY: '¥',
  // Add more as needed
};

const styles = StyleSheet.create({
  rowAligned: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  originalPrice,
  currency = 'USD',
  currencySymbol,
  variant = 'default',
  size = 'md',
  showSavings = true,
  savingsDisplay = 'percentage',
  icon,
  showCurrency = true,
  currencyPosition = 'before',
  decimalPlaces = 2,
  locale = 'en-US',
  compactNotation = false,
  color,
  emphasized = false,
  aligned = false,
  style,
  priceStyle,
  originalPriceStyle,
  savingsStyle,
  layout = 'row',
  testID = 'price-display',
  accessibilityLabel,
  ...rest
}) => {
  const theme = useTheme();

  // Get currency symbol
  const getCurrencySymbol = useMemo(
    () => currencySymbol ?? CURRENCY_SYMBOLS[currency] ?? currency,
    [currencySymbol, currency],
  );

  // Format price with proper localization
  const formatPrice = useMemo(
    () =>
      (amount: number, isCompact = false): string => {
        const options: Intl.NumberFormatOptions = {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        };

        if (isCompact && compactNotation) {
          options.notation = 'compact';
          options.compactDisplay = 'short';
        }

        const formattedNumber = new Intl.NumberFormat(locale, options).format(amount);

        if (!showCurrency) return formattedNumber;

        return currencyPosition === 'before'
          ? `${getCurrencySymbol}${formattedNumber}`
          : `${formattedNumber} ${getCurrencySymbol}`;
      },
    [decimalPlaces, compactNotation, showCurrency, locale, getCurrencySymbol, currencyPosition],
  );

  // Calculate savings
  const savingsInfo = useMemo(() => {
    if (!originalPrice || originalPrice <= price) return null;

    const savingsAmount = originalPrice - price;
    const savingsPercentage = Math.round((savingsAmount / originalPrice) * 100);

    return {
      amount: savingsAmount,
      percentage: savingsPercentage,
      formattedAmount: formatPrice(savingsAmount),
      formattedPercentage: `${savingsPercentage}%`,
    };
  }, [originalPrice, price, formatPrice]);

  // Get variant colors
  const getVariantColors = useMemo(() => {
    const { colors } = theme;

    if (color) {
      return { primary: color, secondary: color, accent: color };
    }

    switch (variant) {
      case 'discounted':
        return {
          primary: colors.success,
          secondary: colors.neutral[600],
          accent: colors.success,
        };
      case 'original':
        return {
          primary: colors.neutral[600],
          secondary: colors.neutral[500],
          accent: colors.neutral[600],
        };
      case 'savings':
        return {
          primary: colors.success,
          secondary: colors.success,
          accent: colors.success,
        };
      case 'total':
        return {
          primary: colors.onSurface,
          secondary: colors.onSurfaceVariant,
          accent: colors.primary,
        };
      case 'default':
        return {
          primary: colors.onSurface,
          secondary: colors.onSurfaceVariant,
          accent: colors.primary,
        };
    }
  }, [theme, variant, color]);

  // Get size styles
  const getSizeStyles = useMemo(() => {
    const baseConfig: Record<
      NonNullable<PriceDisplayProps['size']>,
      {
        main: TypographyVariant;
        secondary: TypographyVariant;
        spacing: keyof typeof theme.spacing.base;
      }
    > = {
      xs: { main: 'body.small', secondary: 'label.small', spacing: 'xs' },
      sm: { main: 'body.medium', secondary: 'body.small', spacing: 'xs' },
      md: { main: 'title.small', secondary: 'body.medium', spacing: 'sm' },
      lg: { main: 'title.medium', secondary: 'title.small', spacing: 'sm' },
      xl: { main: 'title.large', secondary: 'title.medium', spacing: 'md' },
    };

    const config = baseConfig[size];

    return {
      main: config.main,
      secondary: config.secondary,
      spacing: theme.spacing.base[config.spacing],
    };
  }, [theme, size]);

  const iconSpacingStyle = useMemo<ViewStyle>(
    () => ({
      marginRight: getSizeStyles.spacing,
    }),
    [getSizeStyles.spacing],
  );

  const originalPriceSpacingStyle = useMemo<TextStyle>(
    () => ({
      marginLeft: layout === 'row' ? getSizeStyles.spacing : 0,
    }),
    [getSizeStyles.spacing, layout],
  );

  const savingsSpacingStyle = useMemo<TextStyle>(
    () => ({
      marginLeft: layout === 'row' ? getSizeStyles.spacing : 0,
      marginTop: layout === 'column' ? getSizeStyles.spacing / 2 : 0,
    }),
    [getSizeStyles.spacing, layout],
  );

  // Main price component
  const renderMainPrice = () => (
    <View style={styles.rowAligned}>
      {icon !== null && icon !== undefined && icon !== false && (
        <View style={iconSpacingStyle}>{icon}</View>
      )}
      <Text
        variant={getSizeStyles.main}
        weight={emphasized ? 'bold' : 'medium'}
        color={getVariantColors.primary}
        style={[variant === 'original' && styles.strikethrough, priceStyle]}
        testID={`${testID}-main-price`}
      >
        {formatPrice(price)}
      </Text>
    </View>
  );

  // Original price component
  const renderOriginalPrice = () => {
    if (originalPrice === undefined || originalPrice <= price) return null;

    return (
      <Text
        variant={getSizeStyles.secondary}
        color={getVariantColors.secondary}
        style={[styles.strikethrough, originalPriceSpacingStyle, originalPriceStyle]}
        testID={`${testID}-original-price`}
      >
        {formatPrice(originalPrice)}
      </Text>
    );
  };

  // Savings component
  const renderSavings = () => {
    if (!showSavings || savingsInfo === null) return null;

    let savingsText = '';
    switch (savingsDisplay) {
      case 'amount':
        savingsText = `Save ${savingsInfo.formattedAmount}`;
        break;
      case 'percentage':
        savingsText = `${savingsInfo.formattedPercentage} off`;
        break;
      case 'both':
        savingsText = `Save ${savingsInfo.formattedAmount} (${savingsInfo.formattedPercentage})`;
        break;
    }

    return (
      <Text
        variant={getSizeStyles.secondary}
        weight="medium"
        color={getVariantColors.accent}
        style={[savingsSpacingStyle, savingsStyle]}
        testID={`${testID}-savings`}
      >
        {savingsText}
      </Text>
    );
  };

  // Container styles
  const containerStyles = useMemo<ViewStyle>(
    () => ({
      flexDirection: layout,
      alignItems: layout === 'row' ? 'center' : 'flex-start',
      ...(aligned ? { minWidth: 80 } : {}),
    }),
    [layout, aligned],
  );

  // Accessibility label
  const getAccessibilityLabel = useMemo(() => {
    if (accessibilityLabel !== undefined) return accessibilityLabel;

    let label = `Price: ${formatPrice(price)}`;

    if (originalPrice !== undefined && originalPrice > price) {
      label += `, was ${formatPrice(originalPrice)}`;
      if (savingsInfo !== null) {
        label += `, save ${savingsInfo.formattedPercentage}`;
      }
    }

    return label;
  }, [accessibilityLabel, formatPrice, price, originalPrice, savingsInfo]);

  return (
    <View
      style={[containerStyles, style]}
      testID={testID}
      accessible
      accessibilityLabel={getAccessibilityLabel}
      accessibilityRole={'text' as const}
      {...rest}
    >
      {renderMainPrice()}
      {renderOriginalPrice()}
      {renderSavings()}
    </View>
  );
};
