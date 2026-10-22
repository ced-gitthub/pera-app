import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Errors fail the build gate. Warnings are a to-do list that must not grow (see "Quality gates" in CLAUDE.md).
export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'tests/browser/**', 'next-env.d.ts', 'tsconfig.tsbuildinfo'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      '@typescript-eslint/no-explicit-any': 'warn', // use real types; "any" hides bugs
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'off', // the codebase uses short "a && b()" statements
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }], // split big files by topic
      'no-undef': 'off', // TypeScript already checks this
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['src/**'],
    rules: {
      'no-restricted-syntax': ['error', { selector: "CallExpression[callee.name='parseFloat']", message: 'Money must be whole centavos. Use parseAmountMinor(), never parseFloat.' }],
    },
  },
  {
    files: ['src/core/**', 'src/lib/**', 'src/ai/**', 'src/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' }, // plain logic files: a function called use() there is not a React hook
  },
  {
    files: ['tests/**', 'scripts/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-constant-binary-expression': 'off' },
  },
);
