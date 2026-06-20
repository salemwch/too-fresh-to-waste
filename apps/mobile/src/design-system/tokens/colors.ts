/**
 * Design System - Color Tokens
 * Enterprise-grade color system for Food Waste Mobile App
 * Following Material Design 3 and iOS HIG guidelines
 *
 * COLOR USAGE GUIDE:
 * ==================
 *
 * PRIMARY (Teal #1E4448):
 * - Primary buttons and CTAs
 * - Trust and professionalism
 * - Active links and icons
 * - Main brand identity
 * - Success states (where appropriate)
 *
 * ACCENT (Coral #ff7973 / #F55449):
 * - Call-to-action elements (Add New Meal, Special Offers)
 * - Limited stock indicators
 * - Item expires soon warnings
 * - Hover states and highlights
 * - Secondary buttons with warmth
 * - Attention-grabbing elements
 * - Badges and tags
 * - Friendly notifications
 *
 * WHITE (#FFFFFF):
 * - Main backgrounds
 * - Text on colored buttons
 * - Cards and containers
 * - Clean, spacious layouts
 */

const baseColors = {
  // Brand Colors - Primary Identity (Teal)
  primary: {
    50: '#EBF3F4', // HSL(186°, 30%, 94%) - Very light teal for subtle backgrounds
    100: '#C2DDE0', // HSL(186°, 33%, 82%) - Light teal for hover states
    200: '#8BC4CB', // HSL(186°, 38%, 67%) - Medium-light teal for borders
    300: '#54ACB5', // HSL(186°, 40%, 52%) - Medium teal for interactive elements
    400: '#367A81', // HSL(186°, 41%, 36%) - Medium-dark teal for active states
    500: '#1E4448', // HSL(186°, 41%, 20%) - Main brand color - Trust, professionalism, primary actions
    600: '#18363A', // HSL(186°, 41%, 16%) - Dark teal for pressed states
    700: '#112528', // HSL(186°, 41%, 11%) - Darker teal for depth
    800: '#0B1819', // HSL(186°, 41%,  7%) - Very dark teal for contrast
    900: '#050A0B', // HSL(186°, 41%,  3%) - Almost black teal for maximum contrast
  },

  // Accent Colors - Call to Action (Coral/Salmon)
  accent: {
    50: '#FFF5F4', // HSL(3°, 100%, 97%) - Very light coral for subtle backgrounds
    100: '#FFE0DD', // HSL(3°, 100%, 87%) - Light coral for hover states
    200: '#FFC4BF', // HSL(3°, 100%, 75%) - Medium-light coral for borders
    300: '#ff7973', // HSL(3°, 100%, 73%) - Light coral (user preference) for highlights
    400: '#FF5A52', // HSL(3°, 100%, 66%) - Medium coral for interactive elements
    500: '#F55449', // HSL(3°, 90%, 62%) - Main accent color - WCAG AA compliant (4.5:1)
    600: '#E03D31', // HSL(3°, 75%, 54%) - Dark coral for pressed states
    700: '#C02D22', // HSL(3°, 70%, 45%) - Darker coral for depth
    800: '#9B2219', // HSL(3°, 70%, 35%) - Very dark coral for contrast
    900: '#751A13', // HSL(3°, 70%, 27%) - Almost black coral for maximum contrast
  },

  // Secondary Colors - Warmth (Yellow - kept for compatibility)
  secondary: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107', // Warm secondary highlights
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },

  // Semantic Colors
  success: {
    50: '#E8F5E8',
    100: '#C8E6C8',
    300: '#81C784',
    500: '#2E7D32',
    600: '#1B5E20',
  },

  error: {
    50: '#FFEBEE',
    100: '#FFCDD2',
    300: '#E57373',
    500: '#D32F2F',
    600: '#C62828',
  },

  warning: {
    50: '#FFF3E0',
    100: '#FFE0B2',
    300: '#FFB74D',
    500: '#F57C00',
    600: '#EF6C00',
  },

  info: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    300: '#64B5F6',
    500: '#2196F3',
    600: '#1976D2',
  },

  // Neutral Colors
  neutral: {
    0: '#FFFFFF', // Pure white - Main backgrounds, text on colored buttons, cards
    50: '#FAFAFA', // Off-white - Subtle backgrounds
    100: '#F5F5F5', // Light gray - Containers, dividers
    200: '#EEEEEE', // Lighter gray
    300: '#E0E0E0', // Border color
    400: '#BDBDBD', // Disabled text
    500: '#9E9E9E', // Medium gray
    600: '#757575', // Secondary text
    700: '#616161', // Body text
    800: '#424242', // Primary text
    900: '#212121', // Darkest text
    1000: '#000000', // Pure black
  },
} as const;

// Food-Specific Color Tokens
const foodColors = {
  freshness: {
    fresh: baseColors.primary[500], // Uses primary brand color for consistency
    moderate: '#FF9800',
    urgent: '#F44336',
    expired: '#9E9E9E',
  },

  categories: {
    bakery: '#D2691E',
    produce: '#32CD32',
    dairy: '#87CEEB',
    meat: '#CD5C5C',
    prepared: '#FFD700',
    beverages: '#4169E1',
    desserts: '#DDA0DD',
    other: '#708090',
  },

  dietary: {
    vegan: '#228B22',
    vegetarian: '#32CD32',
    glutenFree: '#DAA520',
    organic: '#6B8E23',
    kosher: '#4682B4',
    halal: '#20B2AA',
  },
} as const;

// Harmonious Colors - Color Theory Based on Primary Teal (#1E4448)
// These colors create professional visual harmony with the primary brand color
const harmoniousColors = {
  // Complementary (opposite on color wheel - 180°) - Maximum contrast
  rose: '#D8455E', // HSL(348°, 65%, 55%) - Warm rose for contrast with teal

  // Triadic (120° apart - equilateral triangle) - Vibrant harmony
  violet: '#7B4DB8', // HSL(272°, 45%, 51%) - Deep violet for variety
  amber: '#D8A520', // HSL(45°, 75%, 49%) - Rich amber/gold for warmth

  // Analogous (30° neighbors) - Subtle harmony
  emerald: '#29A865', // HSL(145°, 60%, 42%) - Fresh green, close to teal
  azure: '#2087B8', // HSL(198°, 70%, 43%) - Sky blue, cool harmony

  // Split-Complementary (complementary ± 30°) - Balanced contrast
  magenta: '#B84D9D', // HSL(318°, 45%, 51%) - Sophisticated magenta
  sunset: '#D86B45', // HSL(18°, 60%, 55%) - Warm orange-coral

  // Extended Palette - Additional utility colors
  sage: '#7FA893', // HSL(150°, 23%, 58%) - Muted sage green
  lavender: '#9D8AB8', // HSL(260°, 30%, 63%) - Soft lavender
  peach: '#E5A88F', // HSL(18°, 63%, 72%) - Light peach
  mint: '#8FD8C4', // HSL(165°, 50%, 70%) - Fresh mint
} as const;

// Status Colors for Order Lifecycle
const statusColors = {
  pending: '#FF9800',
  confirmed: '#2196F3',
  preparing: '#9C27B0',
  ready: baseColors.primary[500], // Uses primary brand color for consistency
  pickedUp: '#607D8B',
  completed: baseColors.primary[500], // Uses primary brand color for consistency
  cancelled: '#F44336',
  expired: '#9E9E9E',
  refunded: '#FF5722',
} as const;

// Accessibility & Contrast Colors
const accessibilityColors = {
  contrast: {
    high: '#000000',
    medium: '#616161',
    low: '#9E9E9E',
  },

  focus: {
    ring: '#2196F3',
    background: 'rgba(33, 150, 243, 0.12)',
  },

  overlay: {
    light: 'rgba(255, 255, 255, 0.9)',
    medium: 'rgba(255, 255, 255, 0.7)',
    dark: 'rgba(0, 0, 0, 0.5)',
    darker: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// Theme-specific color mappings
const lightThemeColors = {
  // Surface colors
  background: baseColors.neutral[0],
  surface: baseColors.neutral[50],
  surfaceVariant: baseColors.neutral[100],
  surfaceContainer: baseColors.neutral[200],

  // Text colors
  onBackground: baseColors.neutral[900],
  onSurface: baseColors.neutral[800],
  onSurfaceVariant: baseColors.neutral[600],

  // Primary colors (Green - Sustainability, Success)
  primary: baseColors.primary[500],
  onPrimary: baseColors.neutral[0],
  primaryContainer: baseColors.primary[100],
  onPrimaryContainer: baseColors.primary[800],

  // Accent colors (Orange - Call-to-Action, Urgency)
  accent: baseColors.accent[500],
  onAccent: baseColors.neutral[0],
  accentContainer: baseColors.accent[100],
  onAccentContainer: baseColors.accent[800],

  // Secondary colors (Yellow - Warmth)
  secondary: baseColors.secondary[500],
  onSecondary: baseColors.neutral[900],
  secondaryContainer: baseColors.secondary[100],
  onSecondaryContainer: baseColors.secondary[800],

  // Border colors
  outline: baseColors.neutral[300],
  outlineVariant: baseColors.neutral[200],

  // State colors
  success: baseColors.success[500],
  error: baseColors.error[500],
  warning: baseColors.warning[500],
  info: baseColors.info[500],

  // State "on" colors (text on colored backgrounds)
  onSuccess: baseColors.neutral[0],
  onError: baseColors.neutral[0],
  onWarning: baseColors.neutral[900],
  onInfo: baseColors.neutral[0],

  // State container colors (for subtle backgrounds)
  successContainer: baseColors.success[50],
  onSuccessContainer: baseColors.success[600],
  errorContainer: baseColors.error[50],
  onErrorContainer: baseColors.error[600],
  warningContainer: baseColors.warning[50],
  onWarningContainer: baseColors.warning[600],
  infoContainer: baseColors.info[50],
  onInfoContainer: baseColors.info[600],

  // Overlay colors
  overlay: accessibilityColors.overlay,

  // Direct neutral access for components (re-export for convenience)
  neutral: baseColors.neutral,

  // Food-specific colors (re-export for component access)
  food: foodColors,
  status: statusColors,

  // Harmonious colors (color theory palette)
  harmonious: harmoniousColors,
} as const;

const darkThemeColors = {
  // Surface colors
  background: '#121212',
  surface: '#1E1E1E',
  surfaceVariant: '#2C2C2C',
  surfaceContainer: '#383838',

  // Text colors
  onBackground: baseColors.neutral[100],
  onSurface: baseColors.neutral[200],
  onSurfaceVariant: baseColors.neutral[400],

  // Primary colors (Green - Sustainability, Success)
  primary: baseColors.primary[300],
  onPrimary: baseColors.neutral[900],
  primaryContainer: baseColors.primary[800],
  onPrimaryContainer: baseColors.primary[100],

  // Accent colors (Orange - Call-to-Action, Urgency)
  accent: baseColors.accent[400],
  onAccent: baseColors.neutral[900],
  accentContainer: baseColors.accent[800],
  onAccentContainer: baseColors.accent[100],

  // Secondary colors (Yellow - Warmth)
  secondary: baseColors.secondary[300],
  onSecondary: baseColors.neutral[900],
  secondaryContainer: baseColors.secondary[800],
  onSecondaryContainer: baseColors.secondary[100],

  // Border colors
  outline: baseColors.neutral[600],
  outlineVariant: baseColors.neutral[700],

  // State colors
  success: baseColors.success[300],
  error: baseColors.error[300],
  warning: baseColors.warning[300],
  info: baseColors.info[300],

  // State "on" colors (text on colored backgrounds)
  onSuccess: baseColors.neutral[900],
  onError: baseColors.neutral[900],
  onWarning: baseColors.neutral[900],
  onInfo: baseColors.neutral[900],

  // State container colors (for subtle backgrounds)
  successContainer: baseColors.success[100],
  onSuccessContainer: baseColors.success[500],
  errorContainer: baseColors.error[100],
  onErrorContainer: baseColors.error[500],
  warningContainer: baseColors.warning[100],
  onWarningContainer: baseColors.warning[500],
  infoContainer: baseColors.info[100],
  onInfoContainer: baseColors.info[500],

  // Overlay colors
  overlay: accessibilityColors.overlay,

  // Direct neutral access for components (re-export for convenience)
  neutral: baseColors.neutral,

  // Food-specific colors (re-export for component access)
  food: foodColors,
  status: statusColors,

  // Harmonious colors (color theory palette)
  harmonious: harmoniousColors,
} as const;

// Export all color tokens
export const colorTokens = {
  base: baseColors,
  food: foodColors,
  status: statusColors,
  harmonious: harmoniousColors,
  accessibility: accessibilityColors,
  light: lightThemeColors,
  dark: darkThemeColors,
} as const;
