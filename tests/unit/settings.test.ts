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
    saveProfile({ name: 'Боец', primaryColor: '#a4f', reserveColor: '#4ff', defaultView: 'fp', ballModel: 'smooth', postProcessing: false, showFps: true, showSpeed: true, menuGlow: false, audioViz: false, volumeMaster: 0.5, volumeMusic: 0.3, volumeSfx: 0.8, volumeMenuMusic: 0.6 })
    expect(loadProfile()).toEqual({ name: 'Боец', primaryColor: '#a4f', reserveColor: '#4ff', defaultView: 'fp', ballModel: 'smooth', postProcessing: false, showFps: true, showSpeed: true, menuGlow: false, audioViz: false, volumeMaster: 0.5, volumeMusic: 0.3, volumeSfx: 0.8, volumeMenuMusic: 0.6 })
  })

  it('menuGlow/audioViz сохраняются; отсутствуют/мусор → true', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', menuGlow: false, audioViz: false })
    expect(loadProfile().menuGlow).toBe(false)
    expect(loadProfile().audioViz).toBe(false)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // без полей
    expect(loadProfile().menuGlow).toBe(true)
    expect(loadProfile().audioViz).toBe(true)
  })

  it('громкости сохраняются; отсутствуют → дефолты; вне [0,1] → клампятся', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // без полей
    expect(loadProfile().volumeMaster).toBe(1)        // мастер по умолчанию 100%
    expect(loadProfile().volumeMusic).toBe(0.3)       // музыка матча 30%
    expect(loadProfile().volumeSfx).toBe(1)           // эффекты 100%
    expect(loadProfile().volumeMenuMusic).toBe(0.3)   // музыка меню 30%
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', volumeMaster: 1.7, volumeMusic: -0.3, volumeSfx: 0.42, volumeMenuMusic: 2 })
    expect(loadProfile().volumeMaster).toBe(1)     // > 1 → 1
    expect(loadProfile().volumeMusic).toBe(0)      // < 0 → 0
    expect(loadProfile().volumeSfx).toBe(0.42)     // в диапазоне — как есть
    expect(loadProfile().volumeMenuMusic).toBe(1)  // > 1 → 1
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', volumeMaster: 'nan' as never })
    expect(loadProfile().volumeMaster).toBe(1)     // мусор → 1
  })

  it('showFps/showSpeed сохраняются; отсутствуют/мусор → false', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', showFps: true, showSpeed: true })
    expect(loadProfile().showFps).toBe(true)
    expect(loadProfile().showSpeed).toBe(true)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // без полей
    expect(loadProfile().showFps).toBe(false)
    expect(loadProfile().showSpeed).toBe(false)
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
