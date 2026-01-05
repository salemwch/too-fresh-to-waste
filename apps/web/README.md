# Too Fresh To Waste - Web Application

Production-ready Next.js 15 web application with enterprise-grade SEO,
mobile-first design, and monorepo integration.

## 🎯 Overview

Mobile-first landing page for the Too Fresh To Waste platform. Built with
Next.js 15, TypeScript, and Tailwind CSS, featuring comprehensive SEO
optimization and brand consistency with the mobile app.

## ✅ Phase 1 Complete - Foundation Setup

### What's Implemented

- ✅ **Next.js 15 App Router** - Latest features with App Directory
- ✅ **TypeScript 5.8** - Strict mode enabled for production safety
- ✅ **Tailwind CSS** - Brand colors, 8pt grid system, responsive design
- ✅ **SEO Optimization**
  - Metadata (Open Graph, Twitter Cards)
  - Sitemap.xml (dynamic generation)
  - Robots.txt (dynamic generation)
  - Structured Data (JSON-LD for Google)
- ✅ **Security Headers** - HSTS, CSP, X-Frame-Options, etc.
- ✅ **Monorepo Integration** - Turborepo pipeline, shared packages
- ✅ **Environment Configuration** - .env files with validation
- ✅ **Production Build** - Optimized, code-split, static generation

## 🚀 Quick Start

### Development

```bash
# From monorepo root
pnpm web:dev

# Direct access
cd apps/web
pnpm dev
```

Visit: http://localhost:3001

### Build

```bash
# Production build
pnpm web:build

# Type checking
pnpm web:type-check

# Linting
pnpm web:lint
```

## 📁 Project Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout + SEO metadata
│   │   ├── page.tsx           # Landing page
│   │   ├── sitemap.ts         # Dynamic sitemap
│   │   ├── robots.ts          # Dynamic robots.txt
│   │   └── globals.css        # Tailwind imports
│   ├── components/
│   │   ├── layout/            # Header, Footer, Nav
│   │   ├── landing/           # Hero, Features, CTA
│   │   ├── ui/                # Reusable atoms
│   │   └── StructuredData.tsx # JSON-LD schemas
│   ├── config/
│   │   ├── seo.config.ts      # SEO metadata
│   │   └── env.ts             # Environment validation
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities
│   ├── services/              # API clients
│   └── types/                 # TypeScript definitions
├── public/
│   └── images/                # Static assets
├── .env.example               # Environment template
├── .env.local                 # Local environment (gitignored)
├── next.config.js             # Next.js configuration
├── tailwind.config.ts         # Tailwind + brand colors
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies
```

## 🎨 Design System

### Brand Colors

- **Primary (Teal)**: `#076452` - Trust, professionalism, CTAs
- **Accent (Coral)**: `#F55449` - Urgency, badges, special offers
- **Secondary (Yellow)**: `#FFC107` - Warmth, highlights
- **Semantic**: Success, Error, Warning, Info

### Typography

- Font: Inter (web-optimized)
- Scale: 10px (xs) → 48px (7xl)
- 8pt grid system for spacing

### Responsive Breakpoints

```
xs: 360px   (small mobile)
sm: 640px   (mobile landscape)
md: 768px   (tablet)
lg: 1024px  (desktop)
xl: 1280px  (large desktop)
2xl: 1536px (extra large)
```

## 🔒 Security

- **HTTPS Enforcement**: HSTS headers with preload
- **XSS Protection**: X-XSS-Protection, Content-Security-Policy
- **Clickjacking Prevention**: X-Frame-Options: SAMEORIGIN
- **MIME Sniffing Prevention**: X-Content-Type-Options: nosniff
- **Referrer Policy**: origin-when-cross-origin

## 📊 SEO Features

### Metadata

- Title templates with site name
- Description (optimized for search)
- Keywords targeting food waste reduction
- Open Graph images (1200x630px)
- Twitter Card support

### Structured Data (JSON-LD)

- Organization schema
- Website schema
- Contact information
- Social media profiles

### Sitemaps

- Dynamic generation via `src/app/sitemap.ts`
- Includes all public pages
- Priority and change frequency configured

## 🌍 Environment Variables

See `.env.example` for all available variables:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3000
```

## 🔧 Development Tools

### Available Scripts

```bash
pnpm dev          # Start dev server (port 3001)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Auto-fix ESLint issues
pnpm type-check   # TypeScript validation
pnpm format       # Format code with Prettier
```

### Monorepo Commands

```bash
# From root
pnpm web:dev
pnpm web:build
pnpm web:type-check
pnpm web:lint
```

## 📦 Dependencies

### Production

- **next**: ^15.1.3 - React framework
- **react**: 19.2.0 - UI library
- **react-dom**: 19.2.0 - React DOM renderer
- **next-seo**: ^6.6.0 - SEO utilities
- **sharp**: ^0.33.5 - Image optimization
- **@foodwaste/shared**: workspace:\* - Shared utilities

### Development

- **typescript**: ^5.8.3
- **tailwindcss**: ^3.4.0
- **eslint**: ^9.0.0
- **prettier**: ^3.4.2

## 🎯 Next Steps (Phase 2)

1. **Content Development**
   - Finalize copy (headlines, CTAs, benefits)
   - Prepare images (hero, logo, og-image)
   - Define "How It Works" steps

2. **Component Library**
   - Build UI atoms (Button, Card, Input)
   - Create layout components (Header, Footer)
   - Implement landing sections

3. **Performance**
   - Lazy load images
   - Font optimization
   - Loading states

4. **Analytics**
   - Google Analytics 4 setup
   - Event tracking
   - Conversion tracking

5. **Testing**
   - Lighthouse audit (target: 90+ performance, 100 SEO)
   - Mobile responsiveness
   - Cross-browser testing
   - Accessibility (WCAG AA)

## 📝 Verification Checklist

- ✅ Dev server starts on http://localhost:3001
- ✅ TypeScript compilation passes
- ✅ Production build succeeds
- ✅ ESLint passes with no errors
- ✅ Sitemap accessible at /sitemap.xml
- ✅ Robots.txt accessible at /robots.txt
- ✅ SEO metadata present in page source
- ✅ Tailwind classes working with brand colors
- ✅ Shared package imports working

## 🔗 Links

- **Dev Server**: http://localhost:3001
- **Sitemap**: http://localhost:3001/sitemap.xml
- **Robots**: http://localhost:3001/robots.txt
- **Backend API**: http://localhost:3000/api/v1

## 📄 License

Copyright © 2024 Too Fresh To Waste, Inc.

---

**Status**: ✅ Phase 1 Complete - Production-ready foundation established
