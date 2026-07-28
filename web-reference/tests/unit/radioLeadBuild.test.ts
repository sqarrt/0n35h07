import { describe, it, expect } from 'vitest'
import { MelodyEngine, initialLeadState } from '../../src/radio/music/radio/engines/MelodyEngine'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'
import type { Chord } from '../../src/radio/music/radio/theory'

const CHORD = { notes: [0, 3, 7], name: 'Cm' } as unknown as Chord
const opts = (seed: string, mood = 'dark_techno') => ({
  rng: createRng(seed), leadOctave: 4, density: 0.5,
  scale: [0, 2, 3, 5, 7, 8, 10], keyRoot: 0, anti: new AntiRepeatBuffer(3), moodId: mood,
})
describe('buildLead (3-axis)', () => {
  it('deterministic for the same seed', () => {
    const a = new MelodyEngine().buildLead(CHORD, opts('X'), initialLeadState())
    const b = new MelodyEngine().buildLead(CHORD, opts('X'), initialLeadState())
    expect(a.fragment).toBe(b.fragment)
    expect(a.voice).toBe(b.voice)
  })
  it('keeps the motif across the movement (phrasesLeft)', () => {
    const e = new MelodyEngine()
    const s0 = e.buildLead(CHORD, opts('Y'), initialLeadState())
    const s1 = e.buildLead(CHORD, opts('Y'), s0.state)
    expect(s1.fragment).toBe(s0.fragment) // same movement → same motif
  })
  it('varies across seeds (different leads emerge)', () => {
    const frags = new Set<string>()
    for (let i = 0; i < 30; i++) frags.add(new MelodyEngine().buildLead(CHORD, opts('s' + i), initialLeadState()).fragment)
    expect(frags.size).toBeGreaterThan(10)
  })
  it('always emits a note() body wrapping a 4-bar phrase', () => {
    const r = new MelodyEngine().buildLead(CHORD, opts('Z'), initialLeadState())
    expect(r.fragment.startsWith('note("<')).toBe(true)
    expect(r.fragment.endsWith('>")')).toBe(true)
  })
  it('respects the mood guard — a HARD-only colour never appears under a calm mood', () => {
    const voices = new Set<string>()
    for (let i = 0; i < 150; i++) voices.add(new MelodyEngine().buildLead(CHORD, opts('m' + i, 'dark_ambient'), initialLeadState()).voice)
    expect(voices.has('glitchStorm')).toBe(false)   // glitchStorm is HARD-tagged → excluded under dark_ambient
    expect(voices.size).toBeGreaterThan(3)
  })
})
