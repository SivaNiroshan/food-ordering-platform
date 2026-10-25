import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**','**/generated/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier, // turns off ESLint rules that conflict with Prettier
);
