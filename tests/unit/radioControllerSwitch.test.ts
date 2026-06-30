import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { RadioController, appendEarly } from '../../src/radio/app/RadioController'
import { loadRadioBanks, DEFAULT_RADIO_CONFIG } from '../../src/radio'
import type { RadioBanks } from '../../src/radio'

// Read the real banks from public/radio/*.json via a fetch stub.
const fetchStub = async (url: string) => {
  const text = readFileSync(new URL('../../public' + url, import.meta.url), 'utf8')
  return { ok: true, json: async () => JSON.parse(text) as unknown }
}
const stubEngine = { play: async () => {}, stop: () => {}, setVolume: () => {} }

// records the last evaluated code (for the .early(B) shift) + resume calls (for the un-pause-on-switch check)
const recEngine = () => {
  const e = { last: '', resumed: 0, play: async (c: string) => { e.last = c }, stop: () => {}, setVolume: () => {}, pause: async () => {}, resume: async () => { e.resumed++ } }
  return e
}

let banks: RadioBanks
beforeAll(async () => { banks = await loadRadioBanks(fetchStub, '/radio/') })

function makeController() {
  return new RadioController({ engine: stubEngine, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'TEST' } })
}

describe('RadioController — track switching', () => {
  it('starts on track index 0', () => {
    expect(makeController().currentTrack().index).toBe(0)
  })
  it('next() advances the track index; prev() rewinds (floored at 0)', () => {
    const c = makeController()
    c.next(); expect(c.currentTrack().index).toBe(1)
    c.next(); expect(c.currentTrack().index).toBe(2)
    c.prev(); expect(c.currentTrack().index).toBe(1)
    c.prev(); c.prev(); c.prev(); expect(c.currentTrack().index).toBe(0)   // floored
  })
  it('playTrack(seed, index) replays a specific track deterministically', () => {
    const c = makeController()
    c.playTrack('OTHER', 3)
    const d = c.currentTrack()
    expect(d.seed).toBe('OTHER')   // the SESSION seed → playTrack(d.seed, d.index) replays exactly
    expect(d.index).toBe(3)
    // Determinism: a fresh controller jumped to the same track yields the same descriptor.
    const c2 = makeController(); c2.playTrack('OTHER', 3)
    expect(c2.currentTrack()).toEqual(d)
  })
})

describe('RadioController — seek + position', () => {
  it('seekToFraction(0.5) replays the current program shifted by round(0.5 * totalBars) bars', () => {
    const e = recEngine()
    const c = new RadioController({ engine: e, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'TEST' } })
    c.start()                                   // renders + "plays" track 0 → audibleProgram set
    const bars = c.currentBars()
    expect(bars).toBeGreaterThan(0)
    c.seekToFraction(0.5)
    const B = Math.round(0.5 * bars)
    expect(e.last.endsWith(`.early(${B})`)).toBe(true)
    c.stop()                                    // clear the armed timer (no leak)
  })
  it('seekToFraction(0) replays from the start (no .early)', () => {
    const e = recEngine()
    const c = new RadioController({ engine: e, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'TEST' } })
    c.start()
    c.seekToFraction(0)
    expect(e.last.includes('.early(')).toBe(false)
    c.stop()
  })
  it('progress() advances with the clock and totalMs() is the track duration', () => {
    const e = recEngine()
    const c = new RadioController({ engine: e, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'TEST' } })
    const t0 = 1_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    c.start()
    expect(c.progress()).toBeCloseTo(0, 2)
    nowSpy.mockReturnValue(t0 + c.totalMs() / 2)
    expect(c.progress()).toBeCloseTo(0.5, 1)
    nowSpy.mockReturnValue(t0 + c.totalMs() * 5)   // far past the end → clamped, not >1
    expect(c.progress()).toBe(1)
    nowSpy.mockRestore()
    c.stop()
  })
  it('progress() freezes while paused (position is preserved)', () => {
    const e = recEngine()
    const c = new RadioController({ engine: e, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'TEST' } })
    const t0 = 1_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    c.start()
    nowSpy.mockReturnValue(t0 + c.totalMs() / 4)
    const atPause = c.progress()
    void c.pause()                                  // freezes the clock at this position
    nowSpy.mockReturnValue(t0 + c.totalMs() * 0.9)  // wall clock keeps moving...
    expect(c.progress()).toBeCloseTo(atPause, 5)    // ...but progress stays put
    nowSpy.mockRestore()
    c.stop()
  })
  it('next() while paused resumes the suspended context (un-pause on switch)', () => {
    const e = recEngine()
    const c = new RadioController({ engine: e, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'TEST' } })
    c.start()
    void c.pause()
    expect(e.resumed).toBe(0)
    c.next()
    expect(e.resumed).toBeGreaterThan(0)
    c.stop()
  })
})

describe('appendEarly', () => {
  it('shifts the arrange program left by B bars', () => {
    expect(appendEarly('setcpm(34/4)\narrange(\n  [8, x]\n)', 8)).toBe('setcpm(34/4)\narrange(\n  [8, x]\n).early(8)')
  })
  it('is a no-op for bar 0 (and trims a trailing newline before chaining)', () => {
    expect(appendEarly('arrange(\n  [8, x]\n)', 0)).toBe('arrange(\n  [8, x]\n)')
    expect(appendEarly('arrange(\n  [8, x]\n)\n', 4)).toBe('arrange(\n  [8, x]\n).early(4)')
  })
})
