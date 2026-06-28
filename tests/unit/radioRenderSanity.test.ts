import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { RadioController } from '../../src/radio/app/RadioController'
import { loadRadioBanks, DEFAULT_RADIO_CONFIG } from '../../src/radio'
import type { RadioBanks } from '../../src/radio'

const fetchStub = async (url: string) => {
  const text = readFileSync(new URL('../../public' + url, import.meta.url), 'utf8')
  return { ok: true, json: async () => JSON.parse(text) as unknown }
}
const stubEngine = { play: async () => {}, stop: () => {}, setVolume: () => {} }
let banks: RadioBanks
beforeAll(async () => { banks = await loadRadioBanks(fetchStub, '/radio/') })

// Only () and [] are checked: <> can't be balanced naively (=> arrows add a stray '>'). Angle sequences
// are always emitted as a matched pair by seqAligned, so this still catches the edits that matter.
function balanced(code: string): boolean {
  let p = 0, b = 0
  let q = false
  for (const ch of code) {
    if (ch === '"') { q = !q; continue }
    if (q) continue
    if (ch === '(') p++; else if (ch === ')') p--
    else if (ch === '[') b++; else if (ch === ']') b--
    if (p < 0 || b < 0) return false
  }
  return p === 0 && b === 0 && !q
}

describe('render sanity — generated Strudel is well-formed across many tracks/sections', () => {
  it('every baked section of 40 tracks has balanced ()[]<>"" and is non-empty', () => {
    const c = new RadioController({ engine: stubEngine, banks, config: { ...DEFAULT_RADIO_CONFIG, seed: 'SANITY' } })
    let total = 0
    for (let i = 0; i < 40; i++) {
      const sections = c.bake('SANITY', i)
      expect(sections.length).toBeGreaterThan(0)
      for (const s of sections) {
        total++
        expect(s.bars).toBeGreaterThan(0)
        expect(s.code.length).toBeGreaterThan(0)
        if (!balanced(s.code)) throw new Error(`unbalanced section (track ${i}):\n${s.code}`)
      }
    }
    expect(total).toBeGreaterThan(100)
  })
})
