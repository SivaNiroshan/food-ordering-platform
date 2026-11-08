import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/generated/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally unused parameters prefixed with _ (e.g. Express's 4-argument error handler)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
