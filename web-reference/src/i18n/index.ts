import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Dict } from './dict'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { fr } from './locales/fr'
import { it } from './locales/it'
import { de } from './locales/de'
import { es } from './locales/es'
import { zhCN } from './locales/zhCN'
import { ptBR } from './locales/ptBR'
import { tr } from './locales/tr'
import { pl } from './locales/pl'

export type { Dict } from './dict'
export type LocaleId = 'en' | 'ru' | 'fr' | 'it' | 'de' | 'es' | 'zh-CN' | 'pt-BR' | 'tr' | 'pl'

export const DICTS: Record<LocaleId, Dict> = {
  en, ru, fr, it, de, es, 'zh-CN': zhCN, 'pt-BR': ptBR, tr, pl,
}

/** Registry for the language picker UI: native names. Order = tile order in settings. */
export const LOCALES: { id: LocaleId; native: string }[] = [
  { id: 'en', native: 'English' },
  { id: 'fr', native: 'Français' },
  { id: 'it', native: 'Italiano' },
  { id: 'de', native: 'Deutsch' },
  { id: 'es', native: 'Español' },
  { id: 'zh-CN', native: '简体中文' },
  { id: 'pt-BR', native: 'Português (BR)' },
  { id: 'ru', native: 'Русский' },
  { id: 'tr', native: 'Türkçe' },
  { id: 'pl', native: 'Polski' },
]

const FALLBACK: LocaleId = 'en'

/** System locale: exact match → by prefix (pt-*→pt-BR, zh-*→zh-CN) → en. */
export function detectLocale(langs?: readonly string[]): LocaleId {
  const resolved = langs ?? (typeof navigator !== 'undefined' ? navigator.languages ?? [] : [])
  const ids = LOCALES.map(l => l.id)
  for (const raw of resolved) {
    const exact = ids.find(id => id.toLowerCase() === raw.toLowerCase())
    if (exact) return exact
    const prefix = raw.slice(0, 2).toLowerCase()
    const byPrefix = ids.find(id => id.slice(0, 2).toLowerCase() === prefix)
    if (byPrefix) return byPrefix
  }
  return FALLBACK
}

interface I18nCtx { locale: LocaleId; dict: Dict; setLocale: (id: LocaleId) => void }
const Ctx = createContext<I18nCtx | null>(null)

/** Locale provider. `initial` from the profile (or detectLocale()); `onChange` persists to the profile. */
export function I18nProvider({ initial, onChange, children }: {
  initial: LocaleId
  onChange?: (id: LocaleId) => void
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<LocaleId>(initial)

  // Set lang on first render (initial is read once intentionally)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.lang = initial }, [])

  // Ref keeps setLocale a stable reference (useCallback []),
  // avoiding extra re-renders for context consumers
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const setLocale = useCallback((id: LocaleId) => {
    setLocaleState(id)
    document.documentElement.lang = id
    onChangeRef.current?.(id)
  }, [])

  const value = useMemo<I18nCtx>(() => ({ locale, dict: DICTS[locale], setLocale }), [locale, setLocale])
  return createElement(Ctx.Provider, { value }, children)
}

/**
 * Forces the locale for a subtree (without writing to the profile or changing document.lang).
 * Needed by the trailer: the Steam audience is English-speaking → the entire trailer HUD is always en,
 * regardless of the locale chosen in settings.
 */
export function ForceLocale({ id, children }: { id: LocaleId; children: ReactNode }) {
  const value = useMemo<I18nCtx>(() => ({ locale: id, dict: DICTS[id], setLocale: () => {} }), [id])
  return createElement(Ctx.Provider, { value }, children)
}

function useI18n(): I18nCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useT/useLocale outside I18nProvider')
  return ctx
}

/** Dictionary of the current locale. */
export function useT(): Dict { return useI18n().dict }
/** Current locale + setter (settings screen). */
export function useLocale(): [LocaleId, (id: LocaleId) => void] {
  const { locale, setLocale } = useI18n()
  return [locale, setLocale]
}
