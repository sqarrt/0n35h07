import { describe, it, expect } from 'vitest'
import { DICTS, LOCALES, detectLocale } from '../../src/i18n'
import { en } from '../../src/i18n/locales/en'

describe('i18n', () => {
  it('every locale implements all keys of the en reference', () => {
    const keys = Object.keys(en).sort()
    for (const { id } of LOCALES) {
      expect(Object.keys(DICTS[id]).sort(), `locale ${id}`).toEqual(keys)
    }
  })
  it('detection: exact match', () => {
    expect(detectLocale(['pt-BR'])).toBe('pt-BR')
    expect(detectLocale(['zh-CN'])).toBe('zh-CN')
  })
  it('detection: by prefix', () => {
    expect(detectLocale(['pt-PT'])).toBe('pt-BR')
    expect(detectLocale(['zh-TW'])).toBe('zh-CN')
    expect(detectLocale(['de-AT'])).toBe('de')
  })
  it('detection: unknown → en', () => {
    expect(detectLocale(['ja-JP'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
  it('DICTS and LOCALES are in sync', () => {
    expect(Object.keys(DICTS).sort()).toEqual(LOCALES.map(l => l.id).sort())
  })
})
