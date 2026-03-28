/**
 * Design System - Motion Tokens
 * Animation and transition system for consistent micro-interactions
 */

// Duration tokens - Following Material Design and iOS HIG
const duration = {
  instant: 0,
  fast: 150, // Quick feedback, hover states
  normal: 250, // Standard transitions
  slow: 350, // Complex animations, page transitions
  slower: 500, // Loading states, complex reveals
  slowest: 750, // Hero animations, onboarding
} as const;

// Easing functions - Natural motion curves
const easing = {
  // Standard curves
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',

  // Material Design curves
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Standard entrance/exit
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)', // Elements entering screen
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)', // Elements leaving screen
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)', // Temporary elements

  // iOS curves
  iosStandard: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  iosDecelerate: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  iosAccelerate: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',

  // Custom curves for food app
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// Spring configurations for React Native Reanimated
const spring = {
  // Gentle springs
  gentle: {
    damping: 15,
    stiffness: 120,
    mass: 1,
  },

  // Standard springs
  standard: {
    damping: 20,
    stiffness: 150,
    mass: 1,
  },

  // Bouncy springs
  bouncy: {
    damping: 10,
    stiffness: 120,
    mass: 1,
  },

  // Quick springs
  quick: {
    damping: 25,
    stiffness: 200,
    mass: 0.8,
  },

  // Slow springs
  slow: {
    damping: 30,
    stiffness: 100,
    mass: 1.2,
  },
} as const;

// Animation presets for common interactions
const animations = {
  // Fade animations
  fade: {
    in: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    out: {
      duration: duration.fast,
      easing: easing.accelerate,
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
  },

  // Scale animations
  scale: {
    in: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { scale: 0.8, opacity: 0 },
      to: { scale: 1, opacity: 1 },
    },
    out: {
      duration: duration.fast,
      easing: easing.accelerate,
      from: { scale: 1, opacity: 1 },
      to: { scale: 0.8, opacity: 0 },
    },
    press: {
      duration: duration.fast,
      easing: easing.standard,
      from: { scale: 1 },
      to: { scale: 0.95 },
    },
  },

  // Slide animations
  slide: {
    up: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { translateY: 100, opacity: 0 },
      to: { translateY: 0, opacity: 1 },
    },
    down: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { translateY: -100, opacity: 0 },
      to: { translateY: 0, opacity: 1 },
    },
    left: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { translateX: 100, opacity: 0 },
      to: { translateX: 0, opacity: 1 },
    },
    right: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { translateX: -100, opacity: 0 },
      to: { translateX: 0, opacity: 1 },
    },
  },

  // Food-specific animations
  food: {
    // Card reveal animation
    cardReveal: {
      duration: duration.slow,
      easing: easing.decelerate,
      from: { scale: 0.9, opacity: 0, translateY: 20 },
      to: { scale: 1, opacity: 1, translateY: 0 },
    },

    // Quantity update animation
    quantityUpdate: {
      duration: duration.fast,
      easing: easing.bounce,
      from: { scale: 1 },
      to: { scale: 1.1 },
    },

    // Add to cart animation
    addToCart: {
      duration: duration.normal,
      easing: easing.elastic,
      from: { scale: 1, rotate: '0deg' },
      to: { scale: 1.2, rotate: '10deg' },
    },

    // Loading pulse
    pulse: {
      duration: duration.slower,
      easing: easing.easeInOut,
      from: { opacity: 0.5 },
      to: { opacity: 1 },
      repeat: -1,
      repeatReverse: true,
    },
  },

  // Navigation animations
  navigation: {
    // Screen transitions
    screenSlide: {
      duration: duration.normal,
      easing: easing.standard,
    },

    // Modal animations
    modalSlide: {
      duration: duration.normal,
      easing: easing.decelerate,
      from: { translateY: '100%' },
      to: { translateY: 0 },
    },

    // Tab bar animations
    tabPress: {
      duration: duration.fast,
      easing: easing.standard,
      from: { scale: 1 },
      to: { scale: 0.95 },
    },
  },

  // Feedback animations
  feedback: {
    // Success animations
    success: {
      duration: duration.normal,
      easing: easing.bounce,
      from: { scale: 1, opacity: 0 },
      to: { scale: 1.1, opacity: 1 },
    },

    // Error shake animation
    error: {
      duration: duration.fast,
      easing: easing.standard,
      from: { translateX: 0 },
      to: { translateX: 10 },
      repeat: 3,
      repeatReverse: true,
    },

    // Loading spinner
    spinner: {
      duration: duration.slower,
      easing: easing.linear,
      from: { rotate: '0deg' },
      to: { rotate: '360deg' },
      repeat: -1,
    },
  },
} as const;

// Gesture configurations
const gestures = {
  // Pan gesture thresholds
  pan: {
    threshold: 10,
    velocity: 500,
    distance: 100,
  },

  // Swipe gesture thresholds
  swipe: {
    threshold: 50,
    velocity: 800,
    timeout: 250,
  },

  // Pinch gesture configurations
  pinch: {
    minScale: 0.5,
    maxScale: 3.0,
    threshold: 0.1,
  },
} as const;

// Platform-specific motion preferences
const platformMotion = {
  ios: {
    // iOS prefers more subtle animations
    reducedMotion: {
      duration: duration.fast,
      easing: easing.iosStandard,
    },

    // iOS haptic feedback timing
    haptic: {
      delay: 50,
      duration: 100,
    },
  },

  android: {
    // Android Material Motion
    reducedMotion: {
      duration: duration.normal,
      easing: easing.standard,
    },

    // Android ripple effect
    ripple: {
      duration: duration.normal,
      easing: easing.decelerate,
    },
  },
} as const;

// Export all motion tokens
export const motionTokens = {
  duration,
  easing,
  spring,
  animations,
  gestures,
  platform: platformMotion,
} as const;

// Type definitions
export type Duration = typeof duration;
export type Easing = typeof easing;
export type Spring = typeof spring;
export type Animations = typeof animations;
export type MotionTokens = typeof motionTokens;
