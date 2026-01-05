import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors from mobile design system
        primary: {
          50: '#E6F4F4',
          100: '#CCE9E8',
          200: '#99D3D1',
          300: '#66BDBA',
          400: '#33A6A3',
          500: '#005250',  // Main brand color
          600: '#004240',
          700: '#003130',
          800: '#002120',
          900: '#001110',
        },
        accent: {
          50: '#FFF5F4',
          100: '#FFE7E5',
          200: '#FFCFCB',
          300: '#FFB7B1',
          400: '#FF9F97',
          500: '#F55449',  // Main accent color
          600: '#C4433A',
          700: '#93322C',
          800: '#62221D',
          900: '#751A13',
        },
        secondary: {
          DEFAULT: '#FFC107',
          light: '#FFECB3',
          dark: '#FFA000',
        },
        success: '#2E7D32',
        error: '#D32F2F',
        warning: '#F57C00',
        info: '#2196F3',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['Korolev', 'Verdana', 'Arial Black', 'Arial', 'sans-serif'],
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
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        full: '9999px',
      },
      boxShadow: {
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
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-25%)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
