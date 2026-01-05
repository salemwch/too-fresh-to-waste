/**
 * Design System - Type Definitions
 * TypeScript types for the design system
 */

import type { designTokens } from '../tokens';
import type {
  ViewStyle,
  TextStyle,
  ImageStyle,
  AccessibilityRole,
  AccessibilityState,
  AccessibilityValue,
} from 'react-native';

// Re-export icon types
export type { IconFamily, IconComponent, IconComponentProps } from './icon.types';

// Component size variants
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Component variants
// Note: ButtonVariant and InputVariant are exported from their respective component modules
// to avoid duplicate exports. Import them from '@/design-system/components/atoms/Button'
// and '@/design-system/components/atoms/Input' respectively.
export type CardVariant = 'default' | 'elevated' | 'outlined';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorScheme = 'light' | 'dark';

// Platform types
export type Platform = 'ios' | 'android' | 'web';

// Spacing types
export type SpacingValue = keyof typeof designTokens.spacing.base;
export type RadiusValue = keyof typeof designTokens.spacing.radius;

// Color types
export type ColorValue = string;
export type ThemeColorKey = keyof typeof designTokens.colors.light;

// Typography types
export type TypographyVariant =
  // Full compound variants (preferred)
  | 'display.large'
  | 'display.medium'
  | 'display.small'
  | 'headline.large'
  | 'headline.medium'
  | 'headline.small'
  | 'title.large'
  | 'title.medium'
  | 'title.small'
  | 'body.large'
  | 'body.medium'
  | 'body.small'
  | 'label.large'
  | 'label.medium'
  | 'label.small'
  | 'badge'
  | 'code'
  // Shorthand variants (defaults to medium size) - for backward compatibility
  | 'display'
  | 'headline'
  | 'title'
  | 'body'
  | 'label'
  | 'caption';

// Component props base interface
// Note: Accessibility props are included here for components that don't extend ViewProps directly
// Components extending ViewProps/TouchableOpacityProps may need to omit and re-add these for proper typing
// Using React Native's official accessibility types for type safety
export interface BaseComponentProps {
  testID?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole; // Using React Native's official type
  accessibilityState?: AccessibilityState; // Using React Native's official type
  accessibilityValue?: AccessibilityValue; // Using React Native's official type
}

// Style system types
export interface StyleSystemProps {
  margin?: SpacingValue;
  marginTop?: SpacingValue;
  marginRight?: SpacingValue;
  marginBottom?: SpacingValue;
  marginLeft?: SpacingValue;
  marginHorizontal?: SpacingValue;
  marginVertical?: SpacingValue;

  padding?: SpacingValue;
  paddingTop?: SpacingValue;
  paddingRight?: SpacingValue;
  paddingBottom?: SpacingValue;
  paddingLeft?: SpacingValue;
  paddingHorizontal?: SpacingValue;
  paddingVertical?: SpacingValue;

  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;

  borderRadius?: RadiusValue;
  borderTopLeftRadius?: RadiusValue;
  borderTopRightRadius?: RadiusValue;
  borderBottomLeftRadius?: RadiusValue;
  borderBottomRightRadius?: RadiusValue;

  backgroundColor?: ThemeColorKey | ColorValue;
  borderColor?: ThemeColorKey | ColorValue;
  borderWidth?: number;

  opacity?: number;
  overflow?: 'visible' | 'hidden' | 'scroll';

  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';

  position?: 'absolute' | 'relative';
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  zIndex?: number;
}

// Animation types
export type AnimationType =
  | 'fade'
  | 'scale'
  | 'slide'
  | 'bounce'
  | 'elastic'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight';

export interface AnimationConfig {
  type: AnimationType;
  duration?: number;
  delay?: number;
  easing?: string;
  repeat?: number;
  repeatReverse?: boolean;
}

// Theme context types
export interface ThemeContextValue {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  colors: typeof designTokens.colors.light & { base: typeof designTokens.colors.base };
  // Flattened spacing for better DX - direct access like theme.spacing.md
  spacing: typeof designTokens.spacing.base & typeof designTokens.spacing;
  typography: typeof designTokens.typography;
  shadows: typeof designTokens.shadows;
  motion: typeof designTokens.motion;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

// Component style types
export type ComponentStyle = ViewStyle | TextStyle | ImageStyle;

export interface ThemedStyle {
  light: ComponentStyle;
  dark: ComponentStyle;
}

// Hook return types
export interface UseThemeReturn extends ThemeContextValue {}

export interface UseStylesReturn<T = Record<string, ComponentStyle>> {
  styles: T;
  theme: ThemeContextValue;
}

// Food-specific types
export type FreshnessLevel = 'fresh' | 'moderate' | 'urgent' | 'expired';
export type FoodCategory =
  | 'bakery'
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'prepared'
  | 'beverages'
  | 'desserts'
  | 'other';
export type DietaryType = 'vegan' | 'vegetarian' | 'glutenFree' | 'organic' | 'kosher' | 'halal';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'pickedUp'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

// Component ref types
export type ComponentRef<T = any> = React.RefObject<T> | ((instance: T | null) => void) | null;

// Responsive types
export type ResponsiveValue<T> = T | { mobile?: T; tablet?: T; desktop?: T };

// Breakpoint types
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// Export utility type helpers
export type ExtractTokenValue<T> = T extends Record<string, infer U> ? U : never;
export type TokenKeys<T> = keyof T;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
