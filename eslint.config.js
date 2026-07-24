import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // These rules are overly strict for this codebase's valid patterns:
      // - set-state-in-effect: one-time init in useEffect is intentional
      // - no-useless-assignment: post-increment (order++) is a valid use
      // - react-refresh/only-export-components: useApp hook export is fine
      'react-hooks/set-state-in-effect': 'off',
      'no-useless-assignment': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
