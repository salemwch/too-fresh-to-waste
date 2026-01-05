module.exports = {
  // TypeScript and JavaScript files
  '**/*.{ts,tsx,js,jsx}': [
    'eslint --fix --cache',
    'prettier --write',
    // Skip tsc for now (will run in CI)
  ],

  // JSON files
  '**/*.{json,jsonc}': ['prettier --write'],

  // Markdown files
  '**/*.{md,mdx}': ['prettier --write'],

  // YAML files
  '**/*.{yml,yaml}': ['prettier --write'],

  // Package.json specific
  'package.json': [
    'prettier --write',
    () => 'pnpm install --frozen-lockfile', // Ensure lockfile is up to date
  ],

  // Workspace package.json files
  '{apps,packages}/**/package.json': ['prettier --write'],

  // Test files (additional testing for staged test files)
  '**/*.{test,spec}.{ts,tsx,js,jsx}': ['jest --bail --findRelatedTests --passWithNoTests'],
};
