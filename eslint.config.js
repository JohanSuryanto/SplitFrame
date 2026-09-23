import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'specs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // FR-001: the app never talks to the network.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'SplitFrame must not make network calls (FR-001).' },
        { name: 'XMLHttpRequest', message: 'SplitFrame must not make network calls (FR-001).' },
      ],
    },
  },
);
