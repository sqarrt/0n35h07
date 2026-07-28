import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { CompositionScheduler } from '../../src/radio/music/radio/CompositionScheduler'
import { loadRadioBanks, DEFAULT_RADIO_CONFIG } from '../../src/radio'
import type { RadioBanks } from '../../src/radio'

const fetchStub = async (url: string) => {
  const text = readFileSync(new URL('../../public' + url, import.meta.url), 'utf8')
  return { ok: true, json: async () => JSON.parse(text) as unknown }
}
let banks: RadioBanks
beforeAll(async () => { banks = await loadRadioBanks(fetchStub, '/radio/') })

const mk = (seed: string) => new CompositionScheduler({ banks, config: DEFAULT_RADIO_CONFIG, sessionSeed: seed })

describe('CompositionScheduler — jump determinism (#1: anti-repeat replay)', () => {
  it('jumpTo(N) matches a SEQUENTIAL run reaching N (favorites/bake replay the track the user heard)', () => {
    // The shared anti-repeat buffer mutates per track; a bare jump saw the wrong history → a different
    // mood/key/scale than the sequential session reached. Replay must make them identical.
    for (const seed of ['DIVERGE', 'TEST', 'SANITY']) {
      const seq = mk(seed)
      while (seq.currentIndex() < 5) seq.tick()
      const sequential = seq.descriptor()
      const jumped = mk(seed)
      jumped.jumpTo(5)
      expect(jumped.descriptor()).toEqual(sequential)
    }
  })

  it('jumpTo(N) is independent of prior navigation (deterministic)', () => {
    const a = mk('DIVERGE'); a.jumpTo(6)
    const b = mk('DIVERGE'); b.jumpTo(2); b.jumpTo(9); b.jumpTo(6)
    expect(b.descriptor()).toEqual(a.descriptor())
  })
})
