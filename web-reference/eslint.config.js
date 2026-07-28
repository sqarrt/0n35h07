import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'trailer-dist', 'src-tauri/target']),   // build artifacts — not linted
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
      // Parameters/variables prefixed with _ are intentionally unused (e.g. attachWorld(_rapier)).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Experimental React Compiler rules misfire on valid project patterns:
      // setState in effects (normal React) and imperative mutation of refs/objects in R3F useFrame.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      // Same: misfires on reading refs in event handlers (sessionRef/poolRef.current),
      // which are collected into props via a render function (buildLobby). Reading refs in handlers is valid.
      'react-hooks/refs': 'off',
    },
  },
  {
    // Tests (Vitest/Playwright) aren't React: Playwright's `use` isn't a hook; window debug globals are any by nature.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
