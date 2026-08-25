/**
 * Design System - Spacing Tokens
 * 8pt grid system for consistent spacing across the app
 */

// Base spacing unit - 8pt grid system
const SPACING_UNIT = 8;

/**
 * Core spacing scale.
 *
 * Two kinds of key live here, and the distinction is deliberate (DESIGN.md 4.2):
 *
 * - **Named keys** (`xxs`..`6xl`) carry the semantic rhythm. Proximity encodes
 *   relationship, so these are the ones to reach for by default. The table in
 *   DESIGN.md 4.1 is shared with web and must stay identical on both sides.
 * - **Numeric keys** (`3`, `5`) are the fine-grained steps the named scale does
 *   not cover, and they mean exactly what Tailwind's numeric keys mean on web:
 *   `n x 4px`. `sp[3]` here is `p-3` there, both 12px.
 *
 * The numeric steps were added for MD1 (see MOBILE_DESIGN_DECISION_BRIEF.md).
 * 12px and 20px were already the two most-used spacing values in the app - 297
 * literals between them, 61% of all off-grid spacing - so the scale was the
 * thing that was wrong, not the usage. They are sub-steps, not peers of the
 * named tokens: prefer `md` over `[3]` when either would do.
 */
const spacing = {
  0: 0,
  xxs: SPACING_UNIT * 0.25, // 2px - Extra extra small (minimal gaps, Badge padding)
  xs: SPACING_UNIT * 0.5, // 4px
  sm: SPACING_UNIT * 1, // 8px
  3: SPACING_UNIT * 1.5, // 12px - sub-step between sm and md (web: p-3)
  md: SPACING_UNIT * 2, // 16px
  5: SPACING_UNIT * 2.5, // 20px - sub-step between md and lg (web: p-5)
  lg: SPACING_UNIT * 3, // 24px
  xl: SPACING_UNIT * 4, // 32px
  '2xl': SPACING_UNIT * 5, // 40px
  '3xl': SPACING_UNIT * 6, // 48px
  '4xl': SPACING_UNIT * 8, // 64px
  '5xl': SPACING_UNIT * 10, // 80px
  '6xl': SPACING_UNIT * 12, // 96px
} as const;

// Semantic spacing tokens for common use cases
const semanticSpacing = {
  // Component internal spacing
  component: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  // Screen-level spacing
  screen: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    sectionGap: spacing.xl,
  },

  // Card spacing
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    margin: spacing.sm,
  },

  // List spacing
  list: {
    itemGap: spacing.sm,
    sectionGap: spacing.lg,
    padding: spacing.md,
  },

  // Form spacing
  form: {
    fieldGap: spacing.md,
    sectionGap: spacing.lg,
    buttonGap: spacing.sm,
  },

  // Navigation spacing
  navigation: {
    padding: spacing.md,
    itemGap: spacing.lg,
    iconGap: spacing.sm,
  },
} as const;

// Border radius tokens
const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

// Elevation/Shadow spacing
const elevation = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
} as const;

// Touch target sizing - Accessibility compliant
const touchTarget = {
  minimum: 44, // iOS/Android minimum touch target
  comfortable: 48, // Comfortable touch target
  large: 56, // Large touch target for primary actions
} as const;

// Component-specific sizing
const sizing = {
  // Button heights
  button: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
  },

  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Icon sizes
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 40,
    '3xl': 48,
  },

  // Avatar sizes
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    '2xl': 80,
    '3xl': 96,
  },

  // Badge sizes
  badge: {
    xs: 16, // Extra small badge (notification dot)
    sm: 20, // Small badge (count indicator)
    md: 24, // Medium badge (standard)
    lg: 28, // Large badge (prominent)
  },

  // Card dimensions
  card: {
    minHeight: 120,
    maxWidth: 400,
    imageHeight: 200,
  },

  // Modal/Bottom sheet
  modal: {
    maxWidth: 560,
    minHeight: 200,
  },
} as const;

// Layout spacing - Screen breakpoints and container widths
const layout = {
  // Container max widths
  container: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },

  // Screen margins
  screen: {
    horizontal: spacing.md,
    vertical: spacing.lg,
  },

  // Grid spacing
  grid: {
    gutter: spacing.md,
    columnGap: spacing.sm,
    rowGap: spacing.md,
  },

  // Safe area adjustments
  safeArea: {
    top: spacing.sm,
    bottom: spacing.sm,
    horizontal: spacing.md,
  },
} as const;

// Animation/Motion spacing
const motion = {
  // Animation distances
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // Transform values
  transform: {
    scale: {
      sm: 0.95,
      md: 1.05,
      lg: 1.1,
    },
    translate: {
      sm: spacing.xs,
      md: spacing.sm,
      lg: spacing.md,
    },
  },
} as const;

// Export all spacing tokens
export const spacingTokens = {
  base: spacing,
  semantic: semanticSpacing,
  radius,
  elevation,
  touchTarget,
  sizing,
  layout,
  motion,
  unit: SPACING_UNIT,
} as const;
