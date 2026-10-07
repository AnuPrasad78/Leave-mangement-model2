import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', 'tests/.visual-*/'] },
  js.configs.recommended,
  { ...react.configs['flat'].recommended, settings: { react: { version: '18.3.1' } } },
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // vitest globals (test: { globals: true })
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly'
      }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Vite uses the automatic JSX runtime; this is a plain-JSL JSX app (no TS prop types)
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Pre-existing scrim/backdrop click handlers get proper dialog semantics in the
      // component-library phase; flip these back to error once ConfirmModal/useDismiss land.
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn'
    }
  },
  prettier
]
