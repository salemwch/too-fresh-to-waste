/**
 * Responsive Utilities
 * Responsive design helpers for different screen sizes
 */

import { Dimensions } from 'react-native';

import { designTokens } from '../tokens';

// Get current screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Breakpoint definitions (matches design tokens)
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

// Current breakpoint detection
export const getCurrentBreakpoint = (width: number = screenWidth) => {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
};

// Screen size helpers
export const isTablet = screenWidth >= breakpoints.tablet;
export const isDesktop = screenWidth >= breakpoints.desktop;
export const isMobile = screenWidth < breakpoints.tablet;

// Responsive value helper
export const responsive = <T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
  default?: T;
}): T | undefined => {
  const breakpoint = getCurrentBreakpoint();

  switch (breakpoint) {
    case 'desktop':
      return values.desktop ?? values.tablet ?? values.mobile ?? values.default;
    case 'tablet':
      return values.tablet ?? values.mobile ?? values.default;
    case 'mobile':
    default:
      return values.mobile ?? values.default;
  }
};

// Responsive spacing helper
export const responsiveSpacing = (
  mobile: keyof typeof designTokens.spacing.base,
  tablet?: keyof typeof designTokens.spacing.base,
  desktop?: keyof typeof designTokens.spacing.base,
) =>
  responsive({
    mobile: designTokens.spacing.base[mobile],
    tablet: tablet ? designTokens.spacing.base[tablet] : undefined,
    desktop: desktop ? designTokens.spacing.base[desktop] : undefined,
  });

// Responsive font size helper
export const responsiveFontSize = (
  mobile: keyof typeof designTokens.typography.fontSize,
  tablet?: keyof typeof designTokens.typography.fontSize,
  desktop?: keyof typeof designTokens.typography.fontSize,
) =>
  responsive({
    mobile: designTokens.typography.fontSize[mobile],
    tablet: tablet ? designTokens.typography.fontSize[tablet] : undefined,
    desktop: desktop ? designTokens.typography.fontSize[desktop] : undefined,
  });

// Grid system
export const grid = {
  columns: responsive({
    mobile: 4,
    tablet: 8,
    desktop: 12,
  }),

  gutter: responsiveSpacing('md', 'lg', 'xl'),

  containerPadding: responsiveSpacing('md', 'lg', 'xl'),

  getColumnWidth: (span: number, totalColumns?: number) => {
    const cols = totalColumns || grid.columns || 4;
    const gutterWidth = grid.gutter || 16;
    const containerPadding = grid.containerPadding || 16;
    const availableWidth = screenWidth - containerPadding * 2;
    const columnWidth = (availableWidth - gutterWidth * (cols - 1)) / cols;
    return columnWidth * span + gutterWidth * (span - 1);
  },
};

// Responsive component sizing
export const componentSizing = {
  // Card sizing
  card: {
    width: responsive({
      mobile: screenWidth - 32, // Full width minus padding
      tablet: (screenWidth - 64) / 2 - 8, // Half width minus padding and gap
      desktop: (screenWidth - 96) / 3 - 16, // Third width minus padding and gap
    }),

    height: responsive({
      mobile: 200,
      tablet: 240,
      desktop: 280,
    }),
  },

  // Modal sizing
  modal: {
    width: responsive({
      mobile: screenWidth - 32,
      tablet: Math.min(screenWidth * 0.8, 600),
      desktop: Math.min(screenWidth * 0.6, 800),
    }),

    maxHeight: responsive({
      mobile: screenHeight * 0.9,
      tablet: screenHeight * 0.8,
      desktop: screenHeight * 0.7,
    }),
  },

  // Button sizing
  button: {
    minWidth: responsive({
      mobile: 120,
      tablet: 140,
      desktop: 160,
    }),

    height: responsive({
      mobile: 44,
      tablet: 48,
      desktop: 52,
    }),
  },
};

// Screen orientation helpers
export const orientation = {
  isLandscape: screenWidth > screenHeight,
  isPortrait: screenHeight > screenWidth,
  aspectRatio: screenWidth / screenHeight,
};

// Safe area responsive helpers
export const safeArea = {
  // These would typically come from react-native-safe-area-context
  top: responsive({
    mobile: 44,
    tablet: 24,
    desktop: 0,
  }),

  bottom: responsive({
    mobile: 34,
    tablet: 0,
    desktop: 0,
  }),

  horizontal: responsive({
    mobile: 0,
    tablet: 0,
    desktop: 0,
  }),
};

// Responsive text helpers
export const responsiveText = {
  // Dynamic text scaling based on screen size
  scale: responsive({
    mobile: 1,
    tablet: 1.1,
    desktop: 1.2,
  }),

  // Max width for readable text
  maxWidth: responsive({
    mobile: screenWidth - 32,
    tablet: 600,
    desktop: 800,
  }),

  // Line length optimization
  lineLength: responsive({
    mobile: screenWidth / 16, // ~chars per line
    tablet: 600 / 14,
    desktop: 800 / 16,
  }),
};

// Media query style helper
export const mediaQuery = {
  mobile: (styles: any) => (isMobile ? styles : {}),
  tablet: (styles: any) => (isTablet && !isDesktop ? styles : {}),
  desktop: (styles: any) => (isDesktop ? styles : {}),
  tabletAndUp: (styles: any) => (isTablet ? styles : {}),
  mobileOnly: (styles: any) => (isMobile ? styles : {}),
};

// Dimension change listener helper
export const useDimensions = () =>
  // This would use a state hook to track dimension changes
  ({
    width: screenWidth,
    height: screenHeight,
    isTablet,
    isDesktop,
    isMobile,
    orientation: orientation.isLandscape ? 'landscape' : 'portrait',
  });

// Export responsive utilities
export const responsiveUtils = {
  breakpoints,
  getCurrentBreakpoint,
  responsive,
  responsiveSpacing,
  responsiveFontSize,
  grid,
  componentSizing,
  orientation,
  safeArea,
  responsiveText,
  mediaQuery,
  screen: {
    width: screenWidth,
    height: screenHeight,
    isTablet,
    isDesktop,
    isMobile,
  },
};
