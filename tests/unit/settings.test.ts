import { describe, it, expect, beforeEach } from 'vitest'
import { loadProfile, saveProfile, NAME_MAX } from '../../src/settings'
import { PLAYER_COLORS } from '../../src/constants'
import { MODEL_NAME_RE } from '../../src/names'
import { encodeBallArt, makeEmptyArt } from '../../src/game/ballArt'

beforeEach(() => localStorage.clear())

describe('settings / PlayerProfile', () => {
  it('ballArt: a valid string is saved, garbage is stripped', () => {
    const art = makeEmptyArt(); art.front[0] = 1
    const valid = encodeBallArt(art)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', ballArt: valid })
    expect(loadProfile().ballArt).toBe(valid)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', ballArt: 'garbage' })
    expect(loadProfile().ballArt).toBeUndefined()
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the field
    expect(loadProfile().ballArt).toBeUndefined()
  })

  it('first run: generated "model" name + colors from the palette, saved right away', () => {
    const p = loadProfile()
    expect(p.name).toMatch(MODEL_NAME_RE)
    expect(PLAYER_COLORS).toContain(p.primaryColor)
    expect(PLAYER_COLORS).toContain(p.reserveColor)
    expect(p.reserveColor).not.toBe(p.primaryColor)
    // Saved → second call returns the same (does not regenerate)
    expect(loadProfile()).toEqual(p)
  })

  it('save → load roundtrip', () => {
    saveProfile({ name: 'Fighter', primaryColor: '#a4f', reserveColor: '#4ff', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'wave', shieldStyle: 'crystal', postProcessing: false, showFps: true, showSpeed: true, menuGlow: false, audioViz: false, volumeMaster: 0.5, volumeMusic: 0.3, volumeSfx: 0.8, volumeMenuMusic: 0.6, radioEnabled: true, volumeRadio: 0.5, connectTimeoutSec: 20, searchRole: 'client' })
    expect(loadProfile()).toEqual({ name: 'Fighter', primaryColor: '#a4f', reserveColor: '#4ff', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'wave', shieldStyle: 'crystal', postProcessing: false, showFps: true, showSpeed: true, menuGlow: false, audioViz: false, volumeMaster: 0.5, volumeMusic: 0.3, volumeSfx: 0.8, volumeMenuMusic: 0.6, radioEnabled: true, volumeRadio: 0.5, favorites: [], dislikes: [], connectTimeoutSec: 20, searchRole: 'client' })
  })

  it('favorites/dislikes: valid entries roundtrip, garbage dropped, deduped by seed+index', () => {
    const d = (i: number) => ({ seed: 'S', index: i, mood: 'm', key: 'C', scaleName: 'minor', bpm: 120, style: { kick: 'a', bass: 'b', lead: 'c', bg: 'd', perc: 'e' } })
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', favorites: [d(1), d(1), d(2), 'junk' as never, { seed: 'S' } as never], dislikes: [d(3)] })
    const p = loadProfile()
    expect(p.favorites.map(f => f.index)).toEqual([1, 2])   // deduped, garbage + malformed dropped
    expect(p.favorites[0].style.kick).toBe('a')
    expect(p.dislikes).toHaveLength(1)
  })

  it('favorites/dislikes: missing → empty arrays', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })
    const p = loadProfile()
    expect(p.favorites).toEqual([])
    expect(p.dislikes).toEqual([])
  })

  it('connectTimeoutSec: only from the allowed options; otherwise/missing → 10', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', connectTimeoutSec: 90 })
    expect(loadProfile().connectTimeoutSec).toBe(90)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', connectTimeoutSec: 13 as never })   // not in the list
    expect(loadProfile().connectTimeoutSec).toBe(10)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the field
    expect(loadProfile().connectTimeoutSec).toBe(10)
  })

  it('menuGlow/audioViz are saved; missing/garbage → true', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', menuGlow: false, audioViz: false })
    expect(loadProfile().menuGlow).toBe(false)
    expect(loadProfile().audioViz).toBe(false)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the fields
    expect(loadProfile().menuGlow).toBe(true)
    expect(loadProfile().audioViz).toBe(true)
  })

  it('volumes are saved; missing → defaults; outside [0,1] → clamped', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the fields
    expect(loadProfile().volumeMaster).toBe(1)        // master defaults to 100%
    expect(loadProfile().volumeMusic).toBe(0.3)       // match music 30%
    expect(loadProfile().volumeSfx).toBe(1)           // effects 100%
    expect(loadProfile().volumeMenuMusic).toBe(0.3)   // menu music 30%
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', volumeMaster: 1.7, volumeMusic: -0.3, volumeSfx: 0.42, volumeMenuMusic: 2 })
    expect(loadProfile().volumeMaster).toBe(1)     // > 1 → 1
    expect(loadProfile().volumeMusic).toBe(0)      // < 0 → 0
    expect(loadProfile().volumeSfx).toBe(0.42)     // within range — kept as is
    expect(loadProfile().volumeMenuMusic).toBe(1)  // > 1 → 1
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', volumeMaster: 'nan' as never })
    expect(loadProfile().volumeMaster).toBe(1)     // garbage → 1
  })

  it('showFps/showSpeed are saved; missing/garbage → false', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', showFps: true, showSpeed: true })
    expect(loadProfile().showFps).toBe(true)
    expect(loadProfile().showSpeed).toBe(true)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the fields
    expect(loadProfile().showFps).toBe(false)
    expect(loadProfile().showSpeed).toBe(false)
  })

  it('postProcessing is saved; missing/garbage → true', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', postProcessing: false })
    expect(loadProfile().postProcessing).toBe(false)
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the field
    expect(loadProfile().postProcessing).toBe(true)
  })

  it('defaultView is saved; missing/garbage → fp', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'tp' })
    expect(loadProfile().defaultView).toBe('tp')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4' })   // without the field
    expect(loadProfile().defaultView).toBe('fp')
  })

  it('ballModel is saved; missing/garbage → smooth', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', ballModel: 'waves' })
    expect(loadProfile().ballModel).toBe('waves')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', ballModel: 'bogus' as any })
    expect(loadProfile().ballModel).toBe('smooth')
  })

  it('sanitize: name is trimmed, empty → generated, color outside the palette → default', () => {
    saveProfile({ name: '   ', primaryColor: 'not-a-color', reserveColor: '#4fa' })
    const p = loadProfile()
    expect(p.name).toMatch(MODEL_NAME_RE)
    expect(p.primaryColor).toBe(PLAYER_COLORS[0])
    expect(p.reserveColor).toBe('#4fa')

    saveProfile({ name: 'X'.repeat(50), primaryColor: '#4af', reserveColor: '#fa4' })
    expect(loadProfile().name.length).toBe(NAME_MAX)
  })

  it('reserve cannot equal the primary — it is shifted', () => {
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#4af' })
    const p = loadProfile()
    expect(p.reserveColor).not.toBe('#4af')
    expect(PLAYER_COLORS).toContain(p.reserveColor)
  })

  it('windupStyle: valid is saved, garbage/missing → classic', () => {
    saveProfile({ ...loadProfile(), windupStyle: 'rage' })
    expect(loadProfile().windupStyle).toBe('rage')
    saveProfile({ ...loadProfile(), windupStyle: 'bogus' as never })
    expect(loadProfile().windupStyle).toBe('classic')
  })

  it('respawnStyle: valid is saved, garbage/missing → echo', () => {
    saveProfile({ ...loadProfile(), respawnStyle: 'swarm' })
    expect(loadProfile().respawnStyle).toBe('swarm')
    saveProfile({ ...loadProfile(), respawnStyle: 'bogus' as never })
    expect(loadProfile().respawnStyle).toBe('echo')
  })

  it('dashStyle: valid is saved, garbage/missing → streak', () => {
    saveProfile({ ...loadProfile(), dashStyle: 'rift' })
    expect(loadProfile().dashStyle).toBe('rift')
    saveProfile({ ...loadProfile(), dashStyle: 'bogus' as never })
    expect(loadProfile().dashStyle).toBe('streak')
  })

  it('shieldStyle: valid is saved, garbage/missing → dome', () => {
    saveProfile({ ...loadProfile(), shieldStyle: 'hex' })
    expect(loadProfile().shieldStyle).toBe('hex')
    saveProfile({ ...loadProfile(), shieldStyle: 'bogus' as never })
    expect(loadProfile().shieldStyle).toBe('dome')
  })
})

describe('settings / searchRole', () => {
  it('defaults to both; valid is saved; garbage/legacy random → both', () => {
    expect(loadProfile().searchRole).toBe('both')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', searchRole: 'client' })
    expect(loadProfile().searchRole).toBe('client')
    // legacy 'host' (role removed) and any garbage migrate to both
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', searchRole: 'host' as never })
    expect(loadProfile().searchRole).toBe('both')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', searchRole: 'random' as never })
    expect(loadProfile().searchRole).toBe('both')
    saveProfile({ name: 'A', primaryColor: '#4af', reserveColor: '#fa4', searchRole: 'xx' as never })
    expect(loadProfile().searchRole).toBe('both')
  })
})
