/**
 * Design System Test Setup
 * Configuration for testing the design system components
 */

import '@testing-library/jest-native/extend-expect';

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  // Mock Animated
  RN.Animated.timing = (_value: any, _config: any) => ({
    start: jest.fn((callback?: () => void) => {
      if (callback) callback();
    }),
  });

  // Mock Platform
  RN.Platform.select = jest.fn((config: any) => config.default || config.ios);
  RN.Platform.OS = 'ios';

  // Mock Dimensions
  RN.Dimensions.get = jest.fn(() => ({
    width: 375,
    height: 812,
  }));

  // Mock useColorScheme
  RN.useColorScheme = jest.fn(() => 'light');

  // Mock HapticFeedback
  RN.HapticFeedback = {
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: {
      Light: 'light',
      Medium: 'medium',
      Heavy: 'heavy',
    },
  };

  return RN;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  // Mock additional functions if needed
  Reanimated.default.call = () => {};

  return Reanimated;
});

// Global test utilities
// Use globalThis for Node.js 12+ and TypeScript compatibility
globalThis.console = {
  ...console,
  // Suppress console.warn in tests unless explicitly needed
  warn: jest.fn(),
  // Keep console.error for debugging
  error: console.error,
  log: console.log,
};

// Setup for React Native Testing Library
import { configure } from '@testing-library/react-native';

configure({
  // Add custom configurations if needed
});

// Custom render function for design system components
import { render } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from './providers/ThemeProvider';

import type { RenderResult, RenderOptions } from '@testing-library/react-native';

export const renderWithTheme = (ui: React.ReactElement, options?: RenderOptions): RenderResult => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    React.createElement(ThemeProvider, null, children);

  return render(ui, { wrapper: Wrapper, ...options });
};

// Mock design system tokens for consistent testing
export const mockTokens = {
  colors: {
    primary: '#005250', // Updated to match new teal brand color
    secondary: '#FFC107',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    error: '#D32F2F',
    onPrimary: '#FFFFFF',
    onSurface: '#212121',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    fontSize: {
      sm: 12,
      base: 14,
      md: 16,
      lg: 18,
    },
  },
};

// Test data helpers
export const createMockTheme = (overrides = {}) => ({
  mode: 'light' as const,
  colorScheme: 'light' as const,
  colors: mockTokens.colors,
  spacing: mockTokens.spacing,
  typography: mockTokens.typography,
  shadows: {},
  motion: {},
  setTheme: jest.fn(),
  toggleTheme: jest.fn(),
  ...overrides,
});

// Component testing helpers
export const testComponentVariants = (
  _Component: React.ComponentType<any>,
  variants: string[],
  propName: string = 'variant',
) =>
  variants.map(variant => ({
    name: `${variant} variant`,
    props: { [propName]: variant },
  }));

export const testComponentSizes = (
  _Component: React.ComponentType<any>,
  sizes: string[] = ['xs', 'sm', 'md', 'lg', 'xl'],
) =>
  sizes.map(size => ({
    name: `${size} size`,
    props: { size },
  }));

// Accessibility testing helpers
// Note: @testing-library/jest-native doesn't have toHaveAccessibilityRole/Label matchers
// Use toHaveProp instead for custom accessibility props
export const testAccessibility = {
  expectRole: (element: any, role: string) => {
    expect(element).toHaveProp('accessibilityRole', role);
  },

  expectLabel: (element: any, label: string) => {
    expect(element).toHaveProp('accessibilityLabel', label);
  },

  expectState: (element: any, state: Record<string, boolean>) => {
    expect(element).toHaveProp('accessibilityState', state);
  },
};
