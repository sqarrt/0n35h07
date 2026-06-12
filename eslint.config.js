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
      // Параметры/переменные с префиксом _ — намеренно неиспользуемые (напр. attachWorld(_rapier)).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Экспериментальные правила React Compiler ложно срабатывают на валидных паттернах проекта:
      // setState в эффектах (нормальный React) и императивная мутация ref/объектов в R3F useFrame.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      // То же: ложно срабатывает на чтении ref в обработчиках событий (sessionRef/poolRef.current),
      // которые собираются в пропсы через функцию рендера (buildLobby). Чтение ref в хендлерах — валидно.
      'react-hooks/refs': 'off',
    },
  },
  {
    // Тесты (Vitest/Playwright) — не React: `use` Playwright не хук; window-дебаг-глобалы по природе any.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
