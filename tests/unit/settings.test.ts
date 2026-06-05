import { describe, it, expect, beforeEach } from 'vitest'
import { loadProfile, saveProfile, DEFAULT_NAMES, NAME_MAX } from '../../src/settings'
import { PLAYER_COLORS } from '../../src/constants'

beforeEach(() => localStorage.clear())

describe('settings / PlayerProfile', () => {
  it('первый запуск: случайное шуточное имя из списка + цвета из палитры, и сразу сохранён', () => {
    const p = loadProfile()
    expect(DEFAULT_NAMES).toContain(p.name)
    expect(PLAYER_COLORS).toContain(p.primaryColor)
    expect(PLAYER_COLORS).toContain(p.reserveColor)
    expect(p.reserveColor).not.toBe(p.primaryColor)
    // Записан → второй вызов возвращает то же (не перегенерирует)
    expect(loadProfile()).toEqual(p)
  })

  it('save → load roundtrip', () => {
    saveProfile({ name: 'Боец', primaryColor: '#a4f', reserveColor: '#4ff', defaultView: 'fp', ballModel: 'smooth', postProcessing: false })
    expect(loadProfile()).toEqual({ name: 'Боец', primaryColor: '#a4f', reserveColor: '#4ff', defaultView: 'fp', ballModel: 'smooth', postProcessing: false })
  })

  it('postProcessing сохраняется; отсутствует/мусор → true', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', postProcessing: false })
    expect(loadProfile().postProcessing).toBe(false)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // без поля
    expect(loadProfile().postProcessing).toBe(true)
  })

  it('defaultView сохраняется; отсутствует/мусор → fp', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'tp' })
    expect(loadProfile().defaultView).toBe('tp')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // без поля
    expect(loadProfile().defaultView).toBe('fp')
  })

  it('ballModel сохраняется; отсутствует/мусор → smooth', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', ballModel: 'waves' })
    expect(loadProfile().ballModel).toBe('waves')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', ballModel: 'bogus' as any })
    expect(loadProfile().ballModel).toBe('smooth')
  })

  it('санитайз: имя обрезается, пустое → «Игрок», цвет вне палитры → дефолт', () => {
    saveProfile({ name: '   ', primaryColor: 'not-a-color', reserveColor: '#4fa' })
    const p = loadProfile()
    expect(p.name).toBe('Игрок')
    expect(p.primaryColor).toBe(PLAYER_COLORS[0])
    expect(p.reserveColor).toBe('#4fa')

    saveProfile({ name: 'X'.repeat(50), primaryColor: '#4af', reserveColor: '#fa4' })
    expect(loadProfile().name.length).toBe(NAME_MAX)
  })

  it('резерв не может совпасть с основным — сдвигается', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#4af' })
    const p = loadProfile()
    expect(p.reserveColor).not.toBe('#4af')
    expect(PLAYER_COLORS).toContain(p.reserveColor)
  })
})
