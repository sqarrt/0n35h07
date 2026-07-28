// Separate file for the Dict type to avoid a circular import
// locales/*.ts → index.ts → locales/en.ts
import { en } from './locales/en'

export type Dict = typeof en
