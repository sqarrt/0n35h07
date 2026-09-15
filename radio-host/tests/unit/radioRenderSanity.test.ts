import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { RadioComposer } from '../../src/radio/music/radio/RadioComposer'
import { loadRadioBanks, DEFAULT_RADIO_CONFIG } from '../../src/radio'
import type { RadioBanks } from '../../src/radio'

const fetchStub = async (url: string) => {
  const text = readFileSync(new URL('../../public' + url, import.meta.url), 'utf8')
  return { ok: true, json: async () => JSON.parse(text) as unknown }
}
let banks: RadioBanks
beforeAll(async () => { banks = await loadRadioBanks(fetchStub, '/radio/') })

// Only () and [] are checked: <> can't be balanced naively (=> arrows add a stray '>'). Angle sequences
// are always emitted as a matched pair, so this still catches the edits that matter.
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

describe('render sanity — the generated Strudel program is well-formed across many tracks', () => {
  it('every track program (×40) has balanced ()[] and is non-empty', () => {
    let total = 0
    for (let i = 0; i < 40; i++) {
      const c = new RadioComposer({ banks, config: DEFAULT_RADIO_CONFIG })
      c.reseed('SANITY')
      c.jumpTo(i)
      const program = c.renderArranged()   // the whole track as one arrange() program
      expect(program.length).toBeGreaterThan(0)
      if (!balanced(program)) throw new Error(`unbalanced program (track ${i}):\n${program}`)
      total++
    }
    expect(total).toBe(40)
  })
})
