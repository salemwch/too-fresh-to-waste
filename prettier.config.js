module.exports = {
  // Formatting rules
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,
  endOfLine: 'lf',

  // JSX specific
  jsxSingleQuote: true,
  bracketSameLine: false,

  // Other formatting
  arrowParens: 'avoid',
  bracketSpacing: true,
  insertPragma: false,
  requirePragma: false,
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',

  // File-specific overrides
  overrides: [
    {
      files: ['*.json', '*.jsonc'],
      options: {
        singleQuote: false,
      },
    },
    {
      files: ['*.md', '*.mdx'],
      options: {
        proseWrap: 'always',
        printWidth: 80,
      },
    },
    {
      files: ['*.yaml', '*.yml'],
      options: {
        singleQuote: false,
      },
    },
  ],
};
