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

/** Реестр для UI выбора языка: родные названия. Порядок = порядок плиток в настройках. */
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

/** Системный язык: точное совпадение → по префиксу (pt-*→pt-BR, zh-*→zh-CN) → en. */
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

/** Провайдер языка. `initial` — из профиля (или detectLocale()); `onChange` — персист в профиль. */
export function I18nProvider({ initial, onChange, children }: {
  initial: LocaleId
  onChange?: (id: LocaleId) => void
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<LocaleId>(initial)

  // Устанавливаем lang при первом рендере (initial читается один раз намеренно)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.lang = initial }, [])

  // Ref нужен, чтобы setLocale оставался стабильной ссылкой (useCallback []),
  // не вызывая лишних ре-рендеров у потребителей контекста
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
 * Жёстко задаёт язык поддерева (без записи в профиль и без смены document.lang).
 * Нужен трейлеру: на Steam аудитория англоязычная → весь HUD трейлера всегда на en,
 * независимо от выбранного в настройках языка.
 */
export function ForceLocale({ id, children }: { id: LocaleId; children: ReactNode }) {
  const value = useMemo<I18nCtx>(() => ({ locale: id, dict: DICTS[id], setLocale: () => {} }), [id])
  return createElement(Ctx.Provider, { value }, children)
}

function useI18n(): I18nCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useT/useLocale вне I18nProvider')
  return ctx
}

/** Словарь текущего языка. */
export function useT(): Dict { return useI18n().dict }
/** Текущий язык + сеттер (экран настроек). */
export function useLocale(): [LocaleId, (id: LocaleId) => void] {
  const { locale, setLocale } = useI18n()
  return [locale, setLocale]
}
