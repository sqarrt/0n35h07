// Отдельный файл типа Dict, чтобы избежать цикличного импорта
// locales/*.ts → index.ts → locales/en.ts
import { en } from './locales/en'

export type Dict = typeof en
