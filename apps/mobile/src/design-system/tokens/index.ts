/**
 * Design System - Tokens Index
 * Central export for all design tokens
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './motion';
export * from './shadows';

// Re-export as a unified tokens object
// Combined design tokens for easy access
import { colorTokens } from './colors';
import { motionTokens } from './motion';
import { shadowTokens } from './shadows';
import { spacingTokens } from './spacing';
import { typographyTokens } from './typography';

export const designTokens = {
  colors: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  motion: motionTokens,
  shadows: shadowTokens,
} as const;

// Type definition for the complete design token system
export type DesignTokens = typeof designTokens;
