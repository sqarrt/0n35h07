import { describe, it, expect } from 'vitest'
import { DICTS, LOCALES, detectLocale } from '../../src/i18n'
import { en } from '../../src/i18n/locales/en'

describe('i18n', () => {
  it('каждая локаль реализует все ключи эталона en', () => {
    const keys = Object.keys(en).sort()
    for (const { id } of LOCALES) {
      expect(Object.keys(DICTS[id]).sort(), `локаль ${id}`).toEqual(keys)
    }
  })
  it('детекция: точное совпадение', () => {
    expect(detectLocale(['pt-BR'])).toBe('pt-BR')
    expect(detectLocale(['zh-CN'])).toBe('zh-CN')
  })
  it('детекция: по префиксу', () => {
    expect(detectLocale(['pt-PT'])).toBe('pt-BR')
    expect(detectLocale(['zh-TW'])).toBe('zh-CN')
    expect(detectLocale(['de-AT'])).toBe('de')
  })
  it('детекция: неизвестный → en', () => {
    expect(detectLocale(['ja-JP'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
  it('DICTS и LOCALES синхронны', () => {
    expect(Object.keys(DICTS).sort()).toEqual(LOCALES.map(l => l.id).sort())
  })
})
