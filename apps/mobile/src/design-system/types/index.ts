/**
 * Design System - Type Definitions
 * TypeScript types for the design system
 */

import type { designTokens } from '../tokens';
import type { ComponentShadows } from '../tokens/shadows';
import type {
  ViewStyle,
  AccessibilityRole,
  AccessibilityState,
  AccessibilityValue,
} from 'react-native';

// Shadow type that matches the runtime shape from ThemeProvider.useThemeShadows().
// Platform.select returns platform-specific objects (iOS shadowColor/etc. OR Android
// elevation) — both are valid ViewStyle subsets, so ViewStyle is the correct supertype.
type ShadowLevel = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type ThemeShadows = Record<ShadowLevel, ViewStyle> & {
  component: ComponentShadows;
};

// Re-export icon types
export type { IconFamily } from './icon.types';

// Component size variants
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorScheme = 'light' | 'dark';

// Spacing types
type SpacingValue = keyof typeof designTokens.spacing.base;
type RadiusValue = keyof typeof designTokens.spacing.radius;

// Color types
type ColorValue = string;
type ThemeColorKey = keyof typeof designTokens.colors.light;

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

// Theme context types
export interface ThemeContextValue {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  colors: typeof designTokens.colors.light & { base: typeof designTokens.colors.base };
  // Flattened spacing for better DX - direct access like theme.spacing.md
  spacing: typeof designTokens.spacing.base & typeof designTokens.spacing;
  typography: typeof designTokens.typography;
  shadows: ThemeShadows;
  motion: typeof designTokens.motion;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

// Hook return types
export type UseThemeReturn = ThemeContextValue;
