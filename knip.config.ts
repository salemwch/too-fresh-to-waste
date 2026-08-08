import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // ─── Binaries available via devDependencies but unresolvable in pnpm
  // hoisted monorepo, or installed globally / via npx on CI/servers.
  // `audit-ci` and `powershell` are NOT listed: knip resolves the first from
  // packages/shared's devDependency and treats the `npx `-prefixed call as
  // satisfied, and recognises the second as a system binary. Re-adding them
  // only produces a "remove from ignoreBinaries" hint.
  ignoreBinaries: ['pm2', 'dot', 'gradlew', 'pod', 'fastlane', 'semgrep'],

  ignoreDependencies: [
    '@react-native/eslint-config',
    '@types/multer',
    '@foodwaste/jest-config',
    '@foodwaste/tsconfig',
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
      entry: [
        'src/App.tsx',
        'src/**/types/*.ts',
        // App.tsx defers these behind `require(...) as typeof import(...)` so the
        // work lands after first paint. Knip resolves imports statically and does
        // not follow a runtime require, so every export in them reads as unused —
        // they are entry points in practice. Deleting on that signal would strip
        // the offline write-queue handlers out of a shipping app.
        'src/services/offlineHandlers.ts',
        'src/services/NotificationService.ts',
        'src/utils/offlineManager.ts',
        'src/utils/nativeModuleLogger.ts',
      ],
      project: ['src/**/*.{ts,tsx}'],
      jest: {
        entry: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      },
    },

    // ─── Web (Next.js) ──────────────────────────────────────────────────────
    'apps/web': {
      entry: [
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/not-found.tsx',
        // Declared here rather than through the jest plugin: apps/web/jest.config.js
        // calls next/jest, which resolves relative to process.cwd() and throws
        // "Couldn't find any pages or app directory" when knip loads it from the
        // repo root. The plugin then contributes nothing, and every test file
        // gets reported as unused — along with the testing-library packages only
        // those files import.
        //
        // No src/**/*.spec.{ts,tsx} entry: the app has no .spec files, and an
        // entry pattern matching nothing is itself reported as a config hint.
        'src/**/*.test.{ts,tsx}',
      ],
      // .css is listed so knip follows `import './globals.css'` rather than
      // reporting the extension as excluded on every run.
      project: ['src/**/*.{ts,tsx}', 'src/**/*.css'],
      next: true,
      // Turn the plugin off rather than let it throw the error described above.
      // Left on, every run prints "ERROR: Error loading apps/web/jest.config.js"
      // and exits non-zero, which is what a CI gate reads as a failure.
      jest: false,
      ignoreDependencies: [
        // Named as a bare string in packages/jest-config/next.js
        // (`testEnvironment: 'jest-environment-jsdom'`). Jest resolves it from
        // THIS workspace at runtime, so the devDependency is required here — but
        // knip cannot follow a string literal across a workspace boundary.
        'jest-environment-jsdom',
      ],
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

    // ─── Email templates (react-email) ──────────────────────────────────────
    'packages/email-templates': {
      entry: ['src/**/*.{ts,tsx}'],
      project: ['src/**/*.{ts,tsx}'],
      ignoreDependencies: [
        // Inferred by knip's react-email plugin from the `email dev` preview
        // script. It is an internal dependency of react-email@3.0.6, never
        // imported by our source, so declaring it directly would pin a version
        // of somebody else's private module.
        '@react-email/preview-server',
      ],
    },

    // ─── Shared ESLint presets ──────────────────────────────────────────────
    'packages/eslint-config': {
      ignoreDependencies: [
        // Referenced by ./react and ./react-native, and deliberately declared
        // optional: a consumer importing only ./base or ./nest (the backend)
        // must not be forced to install React lint plugins. Knip sees the
        // reference and wants them non-optional, which would invert that.
        'eslint-plugin-react',
        'eslint-plugin-react-hooks',
        'eslint-plugin-react-native',
      ],
    },

    // ─── Shared tsconfig presets (JSON only — no source) ────────────────────
    'packages/tsconfig': {
      ignoreDependencies: [
        // nextjs.json declares `"plugins": [{ "name": "next" }]` — a TypeScript
        // language-service plugin that the CONSUMING app resolves. This package
        // ships JSON presets and has no node_modules of its own.
        'next',
      ],
    },
  },
};

export default config;
