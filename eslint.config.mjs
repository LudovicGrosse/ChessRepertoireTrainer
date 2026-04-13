import js from '@eslint/js';
import globals from 'globals';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // Keep console for logs in this project
      curly: ['error', 'all'], // FORCE curly braces for all control structures
      eqeqeq: ['error', 'always'], // Force === instead of ==
    },
  },
  prettierConfig,
  {
    ignores: ['node_modules/', 'dist/', 'playwright-report/', 'test-results/', 'package-lock.json'],
  },
];
