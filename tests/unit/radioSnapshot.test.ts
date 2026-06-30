import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RadioComposer } from '../../src/radio/music/radio/RadioComposer'
import { loadRadioBanks } from '../../src/radio/app/radioBanks'
import { DEFAULT_RADIO_CONFIG } from '../../src/radio/music/radio/radioConfig'
import type { RadioBanks } from '../../src/radio/music/radio/banks'

// Byte-identity regression net for the structural radio refactor: pin the EXACT Strudel output of
// renderTrack() for a fixed seed corpus. The refactor (Phases A–B) must keep these snapshots green;
// only a deliberate, ear-checked change (Phase C onward) updates them.
//
// Banks are the real public/radio/*.json (loaded off disk via an injected fetch — no HTTP in vitest).
// The composer is pure (no @strudel/web), so renderTrack runs in node.

const SEEDS = ['WOLF', 'A1B2C3', 'ZZZ9', '7K3M', 'QURTL']   // fixed — byte-identity is tested, not variety
const INDICES = [0, 1, 2]

let banks: RadioBanks

beforeAll(async () => {
  banks = await loadRadioBanks(
    async (url) => ({
      ok: true,
      json: async () => JSON.parse(readFileSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')), 'utf-8')),
    }),
    '/radio/',
  )
})

function render(seed: string, index: number): string {
  const c = new RadioComposer({ banks, config: DEFAULT_RADIO_CONFIG })
  c.reseed(seed)
  c.jumpTo(index)
  return c.renderArranged()   // the actual playback unit now: one arrange() program (sections at cycle 0)
}

describe('radio output snapshot (structural-refactor regression net)', () => {
  it('is deterministic: the same seed+index renders identically twice', () => {
    expect(render('WOLF', 0)).toEqual(render('WOLF', 0))
  })
  it('is meaningful: different seeds produce different output', () => {
    expect(render('WOLF', 0)).not.toEqual(render('ZZZ9', 0))
  })
  for (const seed of SEEDS) for (const index of INDICES) {
    it(`seed=${seed} track=${index} renders identically`, () => {
      expect(render(seed, index)).toMatchSnapshot()
    })
  }
})
