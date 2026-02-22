import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Base recommended rules for all files
  eslint.configs.recommended,

  // Typed linting only for source files (not tests)
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  },

  // Untyped linting for test files
  {
    files: ['src/**/*.test.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
    },
  },

  // Prettier must be last to disable formatting rules
  prettier,

  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.js'],
  },
);
