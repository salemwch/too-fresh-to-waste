/**
 * FoodTag Molecule
 * Production-ready tag component for food categorization with semantic colors
 */

import React, { useCallback, useMemo } from 'react';
import { View, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Text } from '../../atoms/Text';

import type { FoodTagProps } from './FoodTag.types';

// Close icon placeholder
const CloseIcon = () => (
  <View style={{ width: 12, height: 12, backgroundColor: '#666', borderRadius: 6 }} />
);

export const FoodTag: React.FC<FoodTagProps> = ({
  children,
  variant = 'custom',
  size = 'sm',
  category,
  dietaryType,
  freshnessLevel,
  color,
  backgroundColor,
  icon,
  pressable = false,
  onPress,
  selected = false,
  disabled = false,
  closable = false,
  onClose,
  closeIcon = <CloseIcon />,
  borderRadius = 'full',
  style,
  textStyle,
  maxWidth,
  truncate = true,
  testID = 'food-tag',
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  ...rest
}) => {
  const theme = useTheme();

  // Get colors based on variant and semantic type
  const getTagColors = useMemo(() => {
    const { colors } = theme;

    // Custom colors take precedence
    if (color || backgroundColor) {
      return {
        textColor: color || colors.onSurface,
        bgColor: backgroundColor || colors.surfaceVariant,
        borderColor: backgroundColor || colors.outline,
      };
    }

    switch (variant) {
      case 'category':
        if (category) {
          const categoryColor = colors.food.categories[category];
          return {
            textColor: colors.onPrimary,
            bgColor: categoryColor,
            borderColor: categoryColor,
          };
        }
        break;

      case 'dietary':
        if (dietaryType) {
          const dietaryColor = colors.food.dietary[dietaryType];
          return {
            textColor: colors.onPrimary,
            bgColor: dietaryColor,
            borderColor: dietaryColor,
          };
        }
        break;

      case 'freshness':
        if (freshnessLevel) {
          const freshnessColor = colors.food.freshness[freshnessLevel];
          return {
            textColor: colors.onPrimary,
            bgColor: freshnessColor,
            borderColor: freshnessColor,
          };
        }
        break;

      case 'status':
        return {
          textColor: colors.onPrimary,
          bgColor: colors.primary,
          borderColor: colors.primary,
        };

      default:
        // Custom/default variant
        break;
    }

    // Default colors
    return {
      textColor: selected ? colors.onPrimary : colors.onSurfaceVariant,
      bgColor: selected ? colors.primary : colors.surfaceVariant,
      borderColor: selected ? colors.primary : colors.outline,
    };
  }, [theme, variant, category, dietaryType, freshnessLevel, color, backgroundColor, selected]);

  // Size styles
  const getSizeStyles = useMemo(() => {
    const { spacing, typography } = theme;

    switch (size) {
      case 'xs':
        return {
          paddingHorizontal: spacing.base.xs,
          paddingVertical: spacing.base.xs / 2,
          fontSize: typography.fontSize.xs,
          iconSize: 8,
        };
      case 'sm':
        return {
          paddingHorizontal: spacing.base.sm,
          paddingVertical: spacing.base.xs,
          fontSize: typography.fontSize.sm,
          iconSize: 12,
        };
      case 'md':
        return {
          paddingHorizontal: spacing.base.md,
          paddingVertical: spacing.base.sm,
          fontSize: typography.fontSize.base,
          iconSize: 16,
        };
      case 'lg':
        return {
          paddingHorizontal: spacing.base.lg,
          paddingVertical: spacing.base.md,
          fontSize: typography.fontSize.md,
          iconSize: 20,
        };
      case 'xl':
        return {
          paddingHorizontal: spacing.base.xl,
          paddingVertical: spacing.base.lg,
          fontSize: typography.fontSize.lg,
          iconSize: 24,
        };
      default:
        return {
          paddingHorizontal: spacing.base.sm,
          paddingVertical: spacing.base.xs,
          fontSize: typography.fontSize.sm,
          iconSize: 12,
        };
    }
  }, [theme, size]);

  // Border radius styles
  const getBorderRadius = useMemo(() => {
    const { spacing } = theme;

    switch (borderRadius) {
      case 'none':
        return 0;
      case 'sm':
        return spacing.radius.sm;
      case 'md':
        return spacing.radius.md;
      case 'lg':
        return spacing.radius.lg;
      case 'full':
        return spacing.radius.full;
      default:
        return spacing.radius.full;
    }
  }, [theme, borderRadius]);

  // Handle press
  const handlePress = useCallback(() => {
    if (!disabled && onPress) {
      onPress();
    }
  }, [disabled, onPress]);

  // Handle close
  const handleClose = useCallback(
    (event: any) => {
      event.stopPropagation();
      if (!disabled && onClose) {
        onClose();
      }
    },
    [disabled, onClose],
  );

  // Container styles
  const containerStyles = useMemo(
    () => ({
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: getSizeStyles.paddingHorizontal,
      paddingVertical: getSizeStyles.paddingVertical,
      backgroundColor: getTagColors.bgColor,
      borderRadius: getBorderRadius,
      borderWidth: 1,
      borderColor: getTagColors.borderColor,
      opacity: disabled ? 0.6 : 1,
      maxWidth,
      overflow: 'hidden' as const,
    }),
    [getSizeStyles, getTagColors, getBorderRadius, disabled, maxWidth],
  );

  // Text styles
  const textStyles = useMemo(
    () => ({
      color: getTagColors.textColor,
      fontSize: getSizeStyles.fontSize,
      fontWeight: theme.typography.fontWeight?.medium ?? '500',
      lineHeight: getSizeStyles.fontSize * 1.2,
    }),
    [getTagColors, getSizeStyles, theme.typography.fontWeight?.medium],
  );

  // Render content
  const renderContent = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      {icon && <View style={{ marginRight: theme.spacing.base.xs }}>{icon}</View>}

      <Text
        style={[textStyles, textStyle]}
        {...(truncate && { numberOfLines: 1, ellipsizeMode: 'tail' as const })}
      >
        {children}
      </Text>

      {closable && (
        <Pressable
          onPress={handleClose}
          style={{
            marginLeft: theme.spacing.base.xs,
            padding: 2,
          }}
          testID={`${testID}-close`}
          accessibilityRole='button'
          accessibilityLabel='Remove tag'
          accessibilityHint='Removes this tag'
        >
          {closeIcon}
        </Pressable>
      )}
    </View>
  );

  // Accessibility props with proper TypeScript types
  const defaultAccessibilityRole = pressable ? 'button' : 'text';
  const accessibilityProps = {
    accessibilityLabel: accessibilityLabel || `${variant} tag: ${children}`,
    ...(accessibilityHint && { accessibilityHint }),
    ...(!accessibilityHint && pressable && { accessibilityHint: 'Double tap to select' }),
    accessibilityRole: (accessibilityRole || defaultAccessibilityRole) as 'button' | 'text',
    accessibilityState: {
      disabled,
      ...(pressable && { selected }),
    },
  };

  if (pressable) {
    return (
      <Pressable
        onPress={handlePress}
        style={[containerStyles, style]}
        disabled={disabled}
        testID={testID}
        {...accessibilityProps}
        {...rest}
      >
        {renderContent()}
      </Pressable>
    );
  }

  return (
    <View style={[containerStyles, style]} testID={testID} {...accessibilityProps} {...rest}>
      {renderContent()}
    </View>
  );
};

export default FoodTag;
