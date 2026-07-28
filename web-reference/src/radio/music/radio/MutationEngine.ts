import { createRng, type Rng } from '../seededRandom'

// Per-TRACK "mutations" (Switch-Angel-style uniqueness): a track nudges a handful of parameters away from their
// defaults, within SAFE musical bounds, so no two tracks share the same sonic fingerprint. FX/synth knobs are
// numeric (multipliers / offsets); melody knobs are PITCH-SAFE Strudel transforms appended to the lead (drop a
// note / octave jump / ratchet) — never a raw semitone shift (that breaks the key — see the lead .off lesson).

export interface Mutations {
  acidenv: number  // additive offset to the bass acid-env centre (0 = neutral)
  width: number    // detune / unison-width multiplier (1)
  drive: number    // saturation / distortion multiplier (1)
  fm: number       // FM-amount multiplier (1)
  env: number      // bass decay-time multiplier (1)
  room: number     // reverb-wet multiplier (1)
  delay: number    // delay send + feedback multiplier (1)
  swing: number    // additive swing offset (0)
  hats: number     // hat level multiplier (1)
  leadFx: string   // appended SAFE melody transforms; '' = neutral
}

const NEUTRAL: Mutations = { acidenv: 0, width: 1, drive: 1, fm: 1, env: 1, room: 1, delay: 1, swing: 0, hats: 1, leadFx: '' }

const r2 = (x: number) => Math.round(x * 100) / 100

// Each knob mutates ONE field within a safe, musical range ("medium" aggressiveness — clearly audible, never broken).
type Knob = (m: Mutations, rng: Rng) => void
const KNOBS: Record<string, Knob> = {
  // ── timbre / synth ──
  acidenv: (m, r) => { m.acidenv = r2(-0.16 + r.next() * 0.26) }, // -0.16..+0.10 squelch shift
  width: (m, r) => { m.width = r2(0.6 + r.next() * 0.9) },        // 0.6..1.5
  drive: (m, r) => { m.drive = r2(0.6 + r.next() * 1.0) },        // 0.6..1.6
  fm: (m, r) => { m.fm = r2(0.5 + r.next() * 1.2) },              // 0.5..1.7
  env: (m, r) => { m.env = r2(0.65 + r.next() * 0.85) },          // 0.65..1.5
  // ── space / FX ──
  room: (m, r) => { m.room = r2(0.6 + r.next() * 1.1) },          // 0.6..1.7
  delay: (m, r) => { m.delay = r2(0.7 + r.next() * 0.8) },        // 0.7..1.5
  // ── groove ──
  swing: (m, r) => { m.swing = r2(-0.03 + r.next() * 0.12) },     // -0.03..+0.09
  hats: (m, r) => { m.hats = r2(0.7 + r.next() * 0.7) },          // 0.7..1.4
  // ── melody (PITCH-SAFE Strudel ops appended to the lead) ──
  drop: (m, r) => { m.leadFx += `.degradeBy(${r2(0.08 + r.next() * 0.16)})` },                                  // drop ~8-24% of notes → rests
  octave: (m, r) => { m.leadFx += `.sometimesBy(${r2(0.1 + r.next() * 0.16)}, x => x.add(note("<12 -12 12>")))` }, // octave jumps (always in key)
  ratchet: (m, r) => { m.leadFx += `.sometimesBy(${r2(0.1 + r.next() * 0.16)}, x => x.ply(2))` },               // repeat (add) notes
}
const KEYS = Object.keys(KNOBS)

/** Roll a per-track mutation set: pick K (3-4) knobs to nudge, leave the rest neutral. Deterministic by seed. */
export function rollMutations(seed: string): Mutations {
  const rng = createRng(`${seed}:mut`)
  const m: Mutations = { ...NEUTRAL }
  const pool = [...KEYS]
  const k = 3 + (rng.next() < 0.5 ? 1 : 0)
  for (let i = 0; i < k && pool.length; i++) {
    const idx = rng.int(pool.length)
    KNOBS[pool[idx]](m, rng)
    pool.splice(idx, 1)
  }
  return m
}
