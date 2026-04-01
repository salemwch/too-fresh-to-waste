module.exports = {
  // Backend TypeScript — run via pnpm filter so CWD = apps/food-waste-backend
  // and ESLint picks up the project's own flat config (eslint.config.js)
  'apps/food-waste-backend/src/**/*.{ts,js}': (filenames) => [
    `pnpm --filter @foodwaste/backend exec eslint --fix --cache ${filenames.join(' ')}`,
    `prettier --write ${filenames.join(' ')}`,
  ],

  // Web TypeScript — next lint doesn't accept file lists; just format
  'apps/web/src/**/*.{ts,tsx,js,jsx}': ['prettier --write'],

  // Mobile TypeScript — format only; full lint runs in CI
  'apps/mobile/src/**/*.{ts,tsx,js,jsx}': ['prettier --write'],

  // Root-level and packages TypeScript
  'packages/**/*.{ts,tsx,js,jsx}': ['prettier --write'],

  // JSON files
  '**/*.{json,jsonc}': ['prettier --write'],

  // Markdown files
  '**/*.{md,mdx}': ['prettier --write'],

  // YAML files
  '**/*.{yml,yaml}': ['prettier --write'],

  // Workspace package.json files
  '{apps,packages}/**/package.json': ['prettier --write'],
};
