import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // Include packages/ui components in Tailwind scanning
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Companies page palette (cream + teal + dark)
        cream: '#f9f3f0',
        brand: {
          teal: '#005250',
          'teal-light': '#007a78',
          dark: '#0a1f1e',
          coral: '#ff7973',
          // Food-waste editorial page tokens (alias of primary-500 / cream)
          deep: '#1E4448',
          cream: '#F9F3F0',
        },
        // Brand colors from mobile design system (landing page uses these)
        primary: {
          50: '#EBF3F4',
          100: '#C2DDE0',
          200: '#8BC4CB',
          300: '#54ACB5',
          400: '#367A81',
          500: '#1E4448', // Main brand color
          600: '#18363A',
          700: '#112528',
          800: '#0B1819',
          900: '#050A0B',
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          50: '#FFF5F4',
          100: '#FFE7E5',
          200: '#FFCFCB',
          300: '#FFB7B1',
          400: '#FF9F97',
          500: '#F55449', // Main accent color
          600: '#C4433A',
          700: '#93322C',
          800: '#62221D',
          900: '#751A13',
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          light: '#FFECB3',
          dark: '#FFA000',
        },
        // shadcn CSS variable colors
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        gold: '#D4A017',
        // Keep legacy utility colors
        success: '#2E7D32',
        error: '#D32F2F',
        warning: '#F57C00',
        info: '#2196F3',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['Korolev', 'Verdana', 'Arial Black', 'Arial', 'sans-serif'],
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        mono: ['monospace'],
      },
      fontSize: {
        xs: ['10px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.4' }],
        base: ['14px', { lineHeight: '1.5' }],
        md: ['16px', { lineHeight: '1.5' }],
        lg: ['18px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.5' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
        '3xl': ['28px', { lineHeight: '1.4' }],
        '4xl': ['32px', { lineHeight: '1.25' }],
        '5xl': ['36px', { lineHeight: '1.25' }],
        '6xl': ['42px', { lineHeight: '1.25' }],
        '7xl': ['48px', { lineHeight: '1.25' }],
      },
      spacing: {
        // 8pt grid system
        0: '0',
        0.5: '2px',
        1: '4px',
        2: '8px',
        3: '16px',
        4: '24px',
        5: '32px',
        6: '40px',
        7: '48px',
        8: '64px',
        9: '80px',
        10: '96px',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: 'var(--radius)',
        xl: '20px',
        '2xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        'teal-sm': '0 2px 12px rgba(0, 82, 80, 0.06)',
        'teal-form': '0 8px 40px rgba(0, 82, 80, 0.12)',
        soft: '0 30px 60px -30px rgba(30, 68, 72, 0.25)',
        elegant: '0 24px 60px -24px rgba(30, 68, 72, 0.25)',
        'glow-coral': '0 0 0 1px rgba(255, 121, 115, 0.4), 0 0 24px -4px rgba(255, 121, 115, 0.55)',
        coral: '0 20px 50px -20px rgba(255, 121, 115, 0.5)',
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        md: '0 8px 10px -2px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.06)',
        lg: '0 12px 16px -4px rgba(0, 0, 0, 0.1), 0 6px 8px -4px rgba(0, 0, 0, 0.06)',
        xl: '0 16px 24px -8px rgba(0, 0, 0, 0.1), 0 8px 12px -8px rgba(0, 0, 0, 0.06)',
        '2xl': '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
      },
      screens: {
        xs: '360px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      keyframes: {
        // Food-waste editorial page animations
        'marquee-fw': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-25%)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'marquee-fw': 'marquee-fw 40s linear infinite',
        rise: 'rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'float-slower': 'float 8s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite',
        slideUp: 'slideUp 0.3s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
