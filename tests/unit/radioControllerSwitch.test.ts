import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { RadioController } from '../../src/radio/app/RadioController'
import { loadRadioBanks, DEFAULT_RADIO_CONFIG } from '../../src/radio'
import type { RadioBanks } from '../../src/radio'

// Read the real banks from public/radio/*.json via a fetch stub.
const fetchStub = async (url: string) => {
  const text = readFileSync(new URL('../../public' + url, import.meta.url), 'utf8')
  return { ok: true, json: async () => JSON.parse(text) as unknown }
}
const stubEngine = { play: async () => {}, stop: () => {}, setVolume: () => {} }

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
    expect(d.seed).toBe('OTHER:t3')   // the per-track seed embeds the session seed
    expect(d.index).toBe(3)
    // Determinism: a fresh controller jumped to the same track yields the same descriptor.
    const c2 = makeController(); c2.playTrack('OTHER', 3)
    expect(c2.currentTrack()).toEqual(d)
  })
})
