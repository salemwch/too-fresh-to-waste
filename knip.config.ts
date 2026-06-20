import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // ─── Binaries available via devDependencies but unresolvable in pnpm
  // hoisted monorepo, or installed globally / via npx on CI/servers
  ignoreBinaries: [
    'audit-ci',
    'pm2',
    'dot',
    'gradlew',
    'pod',
    'fastlane',
    'semgrep',
  ],

  ignoreDependencies: [
    '@react-native/eslint-config',
    '@types/multer',
    '@foodwaste/jest-config',
    '@foodwaste/tsconfig',
    'tslib',
  ],

  workspaces: {
    // ─── Root ────────────────────────────────────────────────────────────────
    '.': {
      entry: ['turbo.json'],
      project: ['*.{ts,js,cjs,mjs}'],
    },

    // ─── Backend (NestJS) ────────────────────────────────────────────────────
    'apps/food-waste-backend': {
      entry: [
        'src/main.ts',
        'src/app.module.ts',
        // NestJS auto-discovers these via decorators — not statically imported
        'src/**/*.module.ts',
        'src/**/*.controller.ts',
        'src/**/*.service.ts',
        'src/**/*.guard.ts',
        'src/**/*.interceptor.ts',
        'src/**/*.middleware.ts',
        'src/**/*.decorator.ts',
        'src/**/*.schema.ts',
        'src/**/*.strategie.ts',
        'src/**/*.processor.ts',
        'src/**/*.listener.ts',
        'src/**/*.filter.ts',
        'src/**/*.task.ts',
        'src/**/*.presenter.ts',
        'src/**/*.mapper.ts',
        'src/**/*.adapter.ts',
        'src/**/*.util.ts',
        'src/**/*.constant.ts',
        'src/**/*.constants.ts',
        'src/**/*.config.ts',
        'src/**/*.interface.ts',
        'src/**/*.events.ts',
        'src/**/*.types.ts',
        'src/seeds/**/*.ts',
      ],
      project: ['src/**/*.ts'],
      jest: {
        config: ['jest.config.js'],
        entry: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'test/**/*.ts'],
      },
    },

    // ─── Mobile (React Native) ──────────────────────────────────────────────
    'apps/mobile': {
      entry: ['src/App.tsx'],
      project: ['src/**/*.{ts,tsx}'],
      jest: {
        entry: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      },
    },

    // ─── Web (Next.js) ──────────────────────────────────────────────────────
    'apps/web': {
      entry: ['src/app/**/layout.tsx', 'src/app/**/page.tsx', 'src/app/**/not-found.tsx'],
      project: ['src/**/*.{ts,tsx}'],
      next: true,
    },

    // ─── Shared package (library — consumed by all workspaces) ─────────────
    'packages/shared': {
      // All source files are potential library entry points — consumed externally
      // via @foodwaste/shared imports in apps. Knip v6 doesn't cross-trace
      // workspace consumption, so we declare the full src as entry to avoid
      // false "unused file" positives.
      entry: ['src/**/*.ts'],
      project: ['src/**/*.ts'],
    },

    // ─── UI package (library — consumed by web) ──────────────────────────
    'packages/ui': {
      entry: ['src/**/*.{ts,tsx}'],
      project: ['src/**/*.{ts,tsx}'],
    },
  },
};

export default config;
