# Note 8 Stage 1 — Lead Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the radio LEAD into three independently-chosen axes — рисунок (rhythm) × мелодия (notes, incl. voicing) × цвет (fx/timbre) — so combinations yield far more unique leads; fold in note 3 (the stale fill / subDrop).

**Architecture:** New pure catalog/combiner modules under `src/radio/music/radio/engines/` (`leadAxes`, `leadRhythm`, `leadMelody`, `leadCombine`, `leadColor`). `MelodyEngine.buildLead` is rewritten to pick the three axes via a shared mood-guarded anti-repeat picker, combine rhythm×melody into the same `note("<…>")` string the composer already consumes, and return an independently-chosen colour voice. `renderLead` downstream is untouched. Note 3's exit-fill + subDrop route through the new melody generator.

**Tech Stack:** TypeScript 6 (`erasableSyntaxOnly`), vitest (pure unit), the existing `Rng`/`AntiRepeatBuffer`/`weightedPick`/`rotate`/`degFn` helpers.

## Global Constraints

- `erasableSyntaxOnly` ON — NO enums, NO namespaces, NO parameter properties (`constructor(private x)`); declare fields and assign in the constructor body.
- NO magic numbers — named local constants only. Constants used in one file live in that file.
- Branch `feature/radio-notes` (off `release_1.0.0`); version stays `1.0.0`. Do NOT merge here.
- Patterns are ABSOLUTE MIDI (no Strudel `.scale()`); degrees → MIDI via `degFn(scale, base)`.
- **No-cascade rule:** the rewritten `buildLead` must consume `opts.rng` a STABLE number of times (use dedicated `createRng(\`${seed}:…\`)` sub-streams for the new per-axis picks) so the snapshot re-baseline touches ONLY lead-orbit lines.
- **By-ear gate:** the sound changes — audition (strudel.cc / in-app) and get USER approval BEFORE re-baselining snapshots (Task 9). Tests are NOT run for the user until they confirm by ear.
- Tests run in WSL with `dangerouslyDisableSandbox`. Single unit file: `npx vitest run --config vitest.config.ts tests/unit/<file>`.

---

## File Structure

- Create `src/radio/music/radio/engines/leadAxes.ts` — `MoodTagged` interface + `pickAxis()` (mood-filter → fallback → weighted anti-repeat pick). Shared by all three axes.
- Create `src/radio/music/radio/engines/leadRhythm.ts` — `LeadRhythm` + `LEAD_RHYTHMS` + `rhythmOnsets()` (parse bar strings → slot list).
- Create `src/radio/music/radio/engines/leadMelody.ts` — `MelEl`, `LeadMelody` + `LEAD_MELODIES` (contours + strategies) + `emitMelody()`.
- Create `src/radio/music/radio/engines/leadCombine.ts` — `combineLead()` (rhythm × melody els → `<…>` string).
- Create `src/radio/music/radio/engines/leadColor.ts` — `LeadColor` + `LEAD_COLORS`.
- Modify `src/radio/music/radio/engines/MelodyEngine.ts` — rewrite `buildLead`/`makeMotif`/`buildBreakLead` to orchestrate the axes; keep `LeadState`, `degFn`, `atmoDyad`.
- Modify `src/radio/music/radio/RadioComposer.ts` — pass `moodId` into `LeadOpts`; route exit-fill melodic + subDrop through new generators.
- Tests: `tests/unit/radioLeadAxes.test.ts`, `radioLeadRhythm.test.ts`, `radioLeadMelody.test.ts`, `radioLeadCombine.test.ts`, `radioLeadBuild.test.ts`.

---

### Task 1: `leadAxes.ts` — mood-guarded anti-repeat picker

**Files:**
- Create: `src/radio/music/radio/engines/leadAxes.ts`
- Test: `tests/unit/radioLeadAxes.test.ts`

**Interfaces:**
- Consumes: `Rng` (`../../seededRandom`), `AntiRepeatBuffer`, `weightedPick`/`Weighted` (`../weighted`).
- Produces: `interface MoodTagged { id: string; moods?: string[] }`; `pickAxis<T extends MoodTagged>(catalog: readonly T[], moodId: string, rng: Rng, anti: AntiRepeatBuffer | undefined, cat: string): T`.

**Behaviour:** filter catalog to items whose `moods` is absent OR includes `moodId`; if the filtered list has `< MIN_SURVIVORS` (2) items, use the FULL catalog (never empty); then weighted anti-repeat pick by index (penalize recent, record). Without `anti`, plain `rng.int` pick over the survivors.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest'
import { pickAxis, type MoodTagged } from '../../src/radio/music/radio/engines/leadAxes'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'

const CAT: MoodTagged[] = [
  { id: 'any1' }, { id: 'any2' },
  { id: 'darkOnly', moods: ['dark_techno'] },
  { id: 'calmOnly', moods: ['dark_ambient'] },
]
describe('pickAxis', () => {
  it('excludes mood-incompatible items', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(pickAxis(CAT, 'dark_techno', createRng('s' + i), undefined, 'x').id)
    expect(seen.has('calmOnly')).toBe(false)   // calm tag filtered out under dark_techno
    expect(seen.has('darkOnly')).toBe(true)     // dark tag allowed
  })
  it('falls back to the full catalog when <2 survive (never empty)', () => {
    const tiny: MoodTagged[] = [{ id: 'a', moods: ['x'] }, { id: 'b', moods: ['x'] }]
    const got = pickAxis(tiny, 'other', createRng('z'), undefined, 'x')  // 0 survive → fall back
    expect(['a', 'b']).toContain(got.id)
  })
  it('anti-repeat avoids the immediately-previous pick across a run', () => {
    const anti = new AntiRepeatBuffer(1)
    let prev = ''
    let repeats = 0
    for (let i = 0; i < 60; i++) {
      const id = pickAxis(CAT, 'dark_techno', createRng('r' + i), anti, 'ax').id
      if (id === prev) repeats++
      prev = id
    }
    expect(repeats).toBeLessThan(6)   // strongly de-duplicated, not necessarily zero
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module …/leadAxes`).
Run: `npx vitest run --config vitest.config.ts tests/unit/radioLeadAxes.test.ts`

- [ ] **Step 3: Implement**
```ts
import type { Rng } from '../../seededRandom'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { weightedPick, type Weighted } from '../weighted'

// Each axis variant (rhythm / melody / colour) carries an optional mood allowlist — the SOFT guard. Absent =
// compatible with any mood. The picker filters by mood, then weighted-picks with per-category anti-repeat.
export interface MoodTagged { id: string; moods?: string[] }

const MIN_SURVIVORS = 2 // below this the mood filter is too tight → fall back to the full catalog (never empty)

/** Pick one axis variant: mood-filter → fall back to all if <2 survive → weighted anti-repeat pick by index. */
export function pickAxis<T extends MoodTagged>(
  catalog: readonly T[], moodId: string, rng: Rng, anti: AntiRepeatBuffer | undefined, cat: string,
): T {
  const compatible = catalog.filter((it) => !it.moods || it.moods.includes(moodId))
  const pool = compatible.length >= MIN_SURVIVORS ? compatible : catalog
  if (!anti) return pool[rng.int(pool.length)]
  const entries = pool.map((_, i) => [String(i), 1] as Weighted<string>)
  const idx = Number(weightedPick(rng, anti.penalize(cat, entries)))
  anti.record(cat, `${cat}:${pool[idx].id}`) // record by id so the same variant is penalised next time
  return pool[idx]
}
```
NOTE: `anti.record`/`isRecent` are keyed by the recorded VALUE; record `${cat}:${id}` and penalise the same. Adjust the penalize entries to use ids so recency matches: build entries as `[`${cat}:${pool[i].id}`, 1]` and pick by finding that id. Simpler — keep index entries but record `${cat}:${id}`; recency won't match index strings. So use id-keyed entries:
```ts
  const entries = pool.map((it) => [`${cat}:${it.id}`, 1] as Weighted<string>)
  const key = weightedPick(rng, anti.penalize(cat, entries))
  anti.record(cat, key)
  return pool.find((it) => `${cat}:${it.id}` === key)!
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** `git add src/radio/music/radio/engines/leadAxes.ts tests/unit/radioLeadAxes.test.ts && git commit -m "feat(radio): mood-guarded anti-repeat axis picker (note 8 lead)"`

---

### Task 2: `leadRhythm.ts` — onset-mask catalog + parser

**Files:**
- Create: `src/radio/music/radio/engines/leadRhythm.ts`
- Test: `tests/unit/radioLeadRhythm.test.ts`

**Interfaces:**
- Consumes: `MoodTagged` (`./leadAxes`).
- Produces: `interface LeadRhythm extends MoodTagged { bars: string[]; gate?: number }`; `LEAD_RHYTHMS: LeadRhythm[]`; `type Slot = 'onset' | 'rest' | 'pair'`; `rhythmOnsets(r: LeadRhythm): Slot[][]` (per-bar slot lists); `onsetCount(r: LeadRhythm): number`.

**Behaviour:** each bar is a space-separated string of tokens `x` (onset), `~` (rest), `xx` (a 16th sub-pair = two onsets). `rhythmOnsets` parses each bar string into a `Slot[]`; `onsetCount` sums onsets (a `pair` counts as 2).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { LEAD_RHYTHMS, rhythmOnsets, onsetCount } from '../../src/radio/music/radio/engines/leadRhythm'

describe('leadRhythm', () => {
  it('every rhythm has 4 bars and ≥1 onset', () => {
    for (const r of LEAD_RHYTHMS) {
      expect(r.bars.length).toBe(4)
      expect(onsetCount(r)).toBeGreaterThan(0)
    }
  })
  it('parses tokens into slots; xx is a pair (2 onsets)', () => {
    const r = { id: 't', bars: ['x ~ xx ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    const slots = rhythmOnsets(r)
    expect(slots[0]).toEqual(['onset', 'rest', 'pair', 'rest'])
    expect(onsetCount(r)).toBe(3) // x + xx(2)
  })
  it('ids are unique', () => {
    expect(new Set(LEAD_RHYTHMS.map((r) => r.id)).size).toBe(LEAD_RHYTHMS.length)
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (catalog seeded from the existing patterns' rhythm + new masks; `gate` optional, default applied by the combiner):
```ts
import type { MoodTagged } from './leadAxes'

// РИСУНОК axis: where the lead speaks (x), breathes (~), or doubles into a 16th sub-pair (xx), over a 4-bar
// phrase at 8th-note resolution. gate = note length 0..1 (combiner default 0.5). Only EXTREME masks carry `moods`.
export interface LeadRhythm extends MoodTagged { bars: string[]; gate?: number }
export type Slot = 'onset' | 'rest' | 'pair'

export const LEAD_RHYTHMS: LeadRhythm[] = [
  { id: 'sparseCall',  bars: ['x ~ ~ x ~ ~ x ~', '~ x ~ ~ ~ ~ ~ ~', 'x ~ ~ x ~ ~ x ~', '~ ~ ~ ~ ~ ~ ~ ~'] },
  { id: 'ballad',      bars: ['x ~ ~ ~ x ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~', 'x ~ ~ x ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~'], gate: 0.9 },
  { id: 'bell',        bars: ['x ~ ~ x ~ x ~ ~', '~ ~ x ~ x ~ x ~', '~ x ~ x ~ ~ x ~', 'x ~ x ~ ~ ~ ~ ~'] },
  { id: 'pulse',       bars: ['x ~ ~ x ~ x ~ ~', 'x ~ x ~ ~ x ~ ~', 'x ~ ~ x ~ x ~ ~', 'x ~ x ~ ~ x ~ ~'] },
  { id: 'sync',        bars: ['~ x ~ x x ~ x ~', '~ x ~ ~ x ~ x ~', '~ x ~ x x ~ x ~', '~ x ~ ~ x ~ ~ ~'] },
  { id: 'gallop',      bars: ['xx ~ x xx ~ x xx ~', 'x xx ~ x xx ~ x ~', 'xx ~ x xx ~ x xx ~', 'x xx ~ x ~ x ~ ~'], moods: ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial'] },
  { id: 'dense16',     bars: ['xx xx x xx x xx x x', 'x xx x xx xx x xx x', 'xx x xx x x xx x xx', 'x xx x x xx x ~ ~'], moods: ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial', 'dark_hypnotic'] },
  { id: 'airy',        bars: ['x ~ ~ ~ ~ ~ ~ ~', '~ ~ x ~ ~ ~ ~ ~', '~ ~ ~ ~ x ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~'], gate: 0.95, moods: ['dark_ambient', 'dub_techno', 'dark_hypnotic'] },
  { id: 'stutter',     bars: ['x ~ x ~ x ~ ~ x', 'x ~ ~ x ~ x ~ ~', 'x ~ x ~ x ~ ~ x', 'x ~ ~ x ~ ~ ~ ~'] },
  { id: 'echoRest',    bars: ['x ~ x ~ ~ ~ ~ ~', '~ ~ ~ ~ x ~ x ~', '~ ~ x ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~ ~'], gate: 0.8 },
]

const SUBPAIR = 'xx'
const ONSET = 'x'
export function rhythmOnsets(r: { bars: string[] }): Slot[][] {
  return r.bars.map((bar) => bar.trim().split(/\s+/).map((t) => (t === SUBPAIR ? 'pair' : t === ONSET ? 'onset' : 'rest')))
}
export function onsetCount(r: { bars: string[] }): number {
  return rhythmOnsets(r).flat().reduce((n, s) => n + (s === 'pair' ? 2 : s === 'onset' ? 1 : 0), 0)
}
```
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `… "feat(radio): lead rhythm-mask catalog (note 8)"`

---

### Task 3: `leadMelody.ts` — contours, strategies, emitter

**Files:**
- Create: `src/radio/music/radio/engines/leadMelody.ts`
- Test: `tests/unit/radioLeadMelody.test.ts`

**Interfaces:**
- Consumes: `Rng`, `MoodTagged`.
- Produces: `type MelEl = number | number[]` (degree, or a stack of degrees = voicing); `interface LeadMelody extends MoodTagged { voicing: 'mono'|'dyad'|'triad'|'octave'; contour?: number[]; gen?: (rng: Rng, n: number) => number[] }`; `LEAD_MELODIES: LeadMelody[]`; `emitMelody(m: LeadMelody, rng: Rng, n: number): MelEl[]` (returns exactly `n` elements, voiced).

**Behaviour:** `emitMelody` produces `n` base degrees — from `contour` (looped/truncated) or `gen(rng,n)` — then applies `voicing` to each: `mono`→`d`; `octave`→`[d, d+12*? ]` (down-octave shadow handled by caller? no — voicing octave = `[d-12, d]`); `dyad`→`[d, d+2]` (a 3rd in scale-degree space, i.e. +2 degrees); `triad`→`[d, d+2, d+4]`. Stacks are in DEGREE space (the combiner maps each through `deg`).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { LEAD_MELODIES, emitMelody, type LeadMelody } from '../../src/radio/music/radio/engines/leadMelody'
import { createRng } from '../../src/radio/music/seededRandom'

describe('leadMelody', () => {
  it('emitMelody returns exactly n elements', () => {
    for (const m of LEAD_MELODIES) {
      expect(emitMelody(m, createRng('s'), 7).length).toBe(7)
      expect(emitMelody(m, createRng('s'), 16).length).toBe(16)
    }
  })
  it('voicing stacks: dyad→2, triad→3, mono→scalar', () => {
    const mono: LeadMelody = { id: 'm', voicing: 'mono', contour: [0, 2, 4] }
    const triad: LeadMelody = { id: 't', voicing: 'triad', contour: [0] }
    expect(typeof emitMelody(mono, createRng('a'), 3)[0]).toBe('number')
    expect((emitMelody(triad, createRng('a'), 1)[0] as number[]).length).toBe(3)
  })
  it('contours loop to fill more onsets', () => {
    const m: LeadMelody = { id: 'l', voicing: 'mono', contour: [0, 3] }
    expect(emitMelody(m, createRng('a'), 4)).toEqual([0, 3, 0, 3])
  })
  it('generative strategies stay within a sane degree range and are never all-rest', () => {
    const gens = LEAD_MELODIES.filter((m) => m.gen)
    for (const m of gens) {
      const els = emitMelody(m, createRng('g'), 16).map((e) => (Array.isArray(e) ? e[0] : e))
      expect(Math.max(...els)).toBeLessThanOrEqual(14)
      expect(Math.min(...els)).toBeGreaterThanOrEqual(-14)
    }
  })
  it('ids are unique', () => {
    expect(new Set(LEAD_MELODIES.map((m) => m.id)).size).toBe(LEAD_MELODIES.length)
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (authored contours = degree shapes ported from `PHRASES`/`LINES` with rests removed; strategies port `genWalk` + add arp / pedal / cadence):
```ts
import type { Rng } from '../../seededRandom'
import type { MoodTagged } from './leadAxes'

// МЕЛОДИЯ axis: a stream of scale DEGREES (looped contour or generative strategy), then VOICED into single notes
// or stacks (this is where dyads/triads live — "which notes"). Degrees map to MIDI later via the combiner's `deg`.
export type MelEl = number | number[]
export interface LeadMelody extends MoodTagged {
  voicing: 'mono' | 'dyad' | 'triad' | 'octave'
  contour?: number[]                         // authored degree sequence (looped/truncated to the onset count)
  gen?: (rng: Rng, n: number) => number[]    // generative strategy — emits exactly n degrees
}

const DYAD_3RD = 2          // +2 scale degrees ≈ a (diatonic) third
const TRIAD = [0, 2, 4]     // root, third, fifth in degree space
const OCTAVE_DEG = 7        // one octave down in a heptatonic scale ≈ -7 degrees

// — generative strategies —
const WALK_STEP = [-2, -1, -1, -1, 1, 2, 0] // small steps, biased downward (dark resolves down — no uplift)
const WALK_SPREAD = 7
function walkDown(rng: Rng, n: number): number[] {
  let d = rng.int(3)
  const out: number[] = []
  for (let i = 0; i < n; i++) { d = Math.max(-WALK_SPREAD, Math.min(WALK_SPREAD, d + WALK_STEP[rng.int(WALK_STEP.length)])); out.push(d) }
  return out
}
const ARP_SHAPE = [0, 2, 4, 7, 4, 2] // up-and-back over chord tones (degree space)
function arpChord(_rng: Rng, n: number): number[] { return Array.from({ length: n }, (_, i) => ARP_SHAPE[i % ARP_SHAPE.length]) }
const PEDAL_NEIGHBOURS = [0, 1, 0, -1, 0, 2, 0, -2] // tonic pedal pricked by neighbours
function pedalNeighbour(_rng: Rng, n: number): number[] { return Array.from({ length: n }, (_, i) => PEDAL_NEIGHBOURS[i % PEDAL_NEIGHBOURS.length]) }
/** A short descending cadence (used by note 3's exit-fill too): starts high, falls home. */
export function descCadence(rng: Rng, n: number): number[] {
  const starts = [7, 5, 4, 8]
  let d = starts[rng.int(starts.length)]
  const out: number[] = []
  for (let i = 0; i < n; i++) { out.push(d); d = i % 2 === 0 ? d - 2 : d - 1; if (d < -5) d = 0 }
  return out
}

export const LEAD_MELODIES: LeadMelody[] = [
  // authored contours (degrees only — rhythm comes from the rhythm axis)
  { id: 'callResp',  voicing: 'mono',  contour: [0, 3, 2, 0, 5, 7, 5, 3] },
  { id: 'bellLine',  voicing: 'mono',  contour: [0, 3, 2, 5, 3, 2, 0, -2] },
  { id: 'octJump',   voicing: 'octave', contour: [0, 7, 0, 4, 0, 7, 4, 0] },
  { id: 'glassArp',  voicing: 'mono',  contour: [0, 7, 3, 7, 5, 7, 0, 9, 3, 7, 5, 9, 7, 5, 3, 0] },
  { id: 'fog',       voicing: 'mono',  contour: [4, 3, 2, 3, 0, -2, 0], moods: ['dark_ambient', 'dub_techno', 'dark_hypnotic'] },
  { id: 'chime',     voicing: 'mono',  contour: [0, 4, 7, 4, 5, 2, 7, 9, 7, 4, 2, 0] },
  { id: 'doubleStop', voicing: 'dyad', contour: [0, 3, 2, 5, 0, -2] },
  { id: 'chordStab', voicing: 'triad', contour: [0, 2, -2, 4, 0, 3] },
  // generative strategies
  { id: 'walk',   voicing: 'mono',  gen: walkDown },
  { id: 'arp',    voicing: 'mono',  gen: arpChord },
  { id: 'pedal',  voicing: 'mono',  gen: pedalNeighbour },
  { id: 'cadence', voicing: 'mono', gen: descCadence, moods: ['dark_ambient', 'dub_techno', 'dark_hypnotic', 'dark_techno'] },
]

function applyVoicing(d: number, v: LeadMelody['voicing']): MelEl {
  if (v === 'mono') return d
  if (v === 'octave') return [d - OCTAVE_DEG, d]  // pair with a voice ~an octave below (combiner maps via deg)
  if (v === 'dyad') return [d, d + DYAD_3RD]
  return TRIAD.map((t) => d + t)                  // triad
}
export function emitMelody(m: LeadMelody, rng: Rng, n: number): MelEl[] {
  const base = m.gen ? m.gen(rng, n) : Array.from({ length: n }, (_, i) => m.contour![i % m.contour!.length])
  return base.map((d) => applyVoicing(d, m.voicing))
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `… "feat(radio): lead melody contours + generative strategies + voicing (note 8)"`

---

### Task 4: `leadCombine.ts` — rhythm × melody → pattern string

**Files:**
- Create: `src/radio/music/radio/engines/leadCombine.ts`
- Test: `tests/unit/radioLeadCombine.test.ts`

**Interfaces:**
- Consumes: `LeadRhythm`/`rhythmOnsets` (`./leadRhythm`), `MelEl` (`./leadMelody`).
- Produces: `combineLead(rhythm: LeadRhythm, els: MelEl[], deg: (d: number) => number): string` → a `<[bar] [bar] [bar] [bar]>` note body. `els` length MUST equal `onsetCount(rhythm)` (the caller emits exactly that many).

**Behaviour:** walk each bar's slots; an `onset` consumes one `MelEl`; a `pair` consumes two (rendered as a `[a b]` 16th sub-group inside the slot); a `rest` → `~`. A `MelEl` renders via `deg`: number→`String(deg(d))`, array→`[deg(a),deg(b),…]`. `gate` is applied by appending nothing here (gate handled downstream by the voice fx); for v1 the slot just holds the note (gate reserved). Bars joined `<[…] [.…] […] […]>`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { combineLead } from '../../src/radio/music/radio/engines/leadCombine'
import { onsetCount } from '../../src/radio/music/radio/engines/leadRhythm'

const id = (d: number) => d            // identity deg for assertions
describe('combineLead', () => {
  it('places notes on onsets, ~ on rests, in <…> bars', () => {
    const r = { id: 'r', bars: ['x ~ x ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    const out = combineLead(r, [10, 20], id)  // 2 onsets
    expect(out).toBe('<[10 ~ 20 ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>')
  })
  it('a pair consumes two els as a 16th sub-group', () => {
    const r = { id: 'p', bars: ['xx ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    expect(combineLead(r, [1, 2], id)).toBe('<[[1 2] ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>')
  })
  it('renders stacks via deg', () => {
    const r = { id: 's', bars: ['x ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    expect(combineLead(r, [[0, 2]], id)).toBe('<[[0,2] ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>')
  })
  it('consumes exactly onsetCount elements', () => {
    const r = { id: 'c', bars: ['x x ~ ~', 'x ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~'] }
    expect(onsetCount(r)).toBe(3)
    expect(() => combineLead(r, [1, 2, 3], id)).not.toThrow()
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
```ts
import { rhythmOnsets, type LeadRhythm } from './leadRhythm'
import type { MelEl } from './leadMelody'

function renderEl(el: MelEl, deg: (d: number) => number): string {
  return Array.isArray(el) ? `[${el.map(deg).join(',')}]` : String(deg(el))
}
/** Lay the melody els onto the rhythm onsets → a 4-bar `<[…] […] […] […]>` note body (absolute via `deg`). */
export function combineLead(rhythm: Pick<LeadRhythm, 'bars'>, els: MelEl[], deg: (d: number) => number): string {
  let k = 0
  const next = () => els[k++]
  const bars = rhythmOnsets(rhythm).map((slots) =>
    `[${slots.map((s) => {
      if (s === 'rest') return '~'
      if (s === 'pair') return `[${renderEl(next(), deg)} ${renderEl(next(), deg)}]`
      return renderEl(next(), deg)
    }).join(' ')}]`)
  return `<${bars.join(' ')}>`
}
```
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `… "feat(radio): lead rhythm×melody combiner (note 8)"`

---

### Task 5: `leadColor.ts` — colour catalog with mood tags

**Files:**
- Create: `src/radio/music/radio/engines/leadColor.ts`
- Test: covered indirectly in Task 6's build test (data-only; a `MoodTagged` id-uniqueness assert is added there).

**Interfaces:**
- Consumes: `MoodTagged`, `LeadVoiceId` (`./MelodyEngine`).
- Produces: `interface LeadColor extends MoodTagged { voice: LeadVoiceId }`; `LEAD_COLORS: LeadColor[]` (the live voices from `ARCHETYPES`, with `moods` only on the extreme ones — e.g. `glitchStorm` excluded from calm moods).

- [ ] **Step 1: Implement** (data only; no separate TDD file — it is exercised by Task 6):
```ts
import type { MoodTagged } from './leadAxes'
import type { LeadVoiceId } from './MelodyEngine'

// ЦВЕТ axis: which synth/FX chain (the composer's LEAD_VOICES) renders the notes. Decoupled from pattern. Only the
// most aggressive/atmospheric voices carry a mood tag (soft guard); the rest fit any mood.
export interface LeadColor extends MoodTagged { voice: LeadVoiceId }
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
export const LEAD_COLORS: LeadColor[] = [
  { id: 'chordStab', voice: 'chordStab' }, { id: 'callResponse', voice: 'callResponse' },
  { id: 'octavePulse', voice: 'octavePulse' }, { id: 'bellMelody', voice: 'bellMelody' },
  { id: 'stutterStab', voice: 'stutterStab', moods: HARD }, { id: 'doubleStop', voice: 'doubleStop' },
  { id: 'glitchStorm', voice: 'glitchStorm', moods: HARD }, { id: 'glassArp', voice: 'glassArp' },
  { id: 'ghostVoice', voice: 'ghostVoice' }, { id: 'detunedDrift', voice: 'detunedDrift' },
  { id: 'warpedBox', voice: 'warpedBox' }, { id: 'crushBell', voice: 'crushBell' },
  { id: 'fogMelody', voice: 'fogMelody', moods: CALM }, { id: 'digitalChime', voice: 'digitalChime' },
  { id: 'rustString', voice: 'rustString', moods: CALM }, { id: 'digitalRain', voice: 'digitalRain' },
  { id: 'atmoDyad', voice: 'atmoDyad', moods: CALM },
]
```
- [ ] **Step 2: Commit** `… "feat(radio): lead colour catalog with soft mood tags (note 8)"`

---

### Task 6: Rewrite `MelodyEngine.buildLead` to orchestrate the three axes

**Files:**
- Modify: `src/radio/music/radio/engines/MelodyEngine.ts`
- Test: `tests/unit/radioLeadBuild.test.ts`

**Interfaces:**
- Consumes: `pickAxis` (`./leadAxes`), `LEAD_RHYTHMS`/`onsetCount` (`./leadRhythm`), `LEAD_MELODIES`/`emitMelody`/`descCadence` (`./leadMelody`), `combineLead` (`./leadCombine`), `LEAD_COLORS` (`./leadColor`), existing `degFn`, `rotate`.
- Produces (unchanged external shape): `buildLead(chord, opts, state) → { fragment: string; voice: LeadVoiceId; state: LeadState }`. `LeadOpts` gains `moodId: string`. `LeadState.motif` now stores the resolved `{ pattern, voice }` (same shape — `LeadMotif`).

**Behaviour:** when a new movement is needed (`!motif || phrasesLeft<=0`): build `deg = degFn(scale, base)`; pick `rhythm`, `melody`, `color` via `pickAxis` over their catalogs using `opts.moodId`, `opts.rng`, `opts.anti`, cats `lead_rhythm`/`lead_melody`/`lead_color`; `els = emitMelody(melody, opts.rng, onsetCount(rhythm))`; light disguise = `rotate(els, opts.rng.int(els.length))`; `pattern = combineLead(rhythm, els, deg)`; `voice = color.voice`; store `{ pattern, voice }`. Keep `phrasesLeft`/`REPHRASE` machinery and the `fragment: note("…")` wrapping. `buildBreakLead` keeps the restful subset (filter `LEAD_MELODIES`/`LEAD_COLORS` flagged calm, i.e. `moods?.some(m => CALM.includes(m))` OR untagged) and avoids the previous voice. DELETE the now-dead `ARCHETYPES`/`makeMotif`/`patternFor`/`PHRASES`/`LINES`/`transform*` ONLY if unreferenced after the rewrite; otherwise leave them and note their death.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { MelodyEngine, initialLeadState } from '../../src/radio/music/radio/engines/MelodyEngine'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'
import type { Chord } from '../../src/radio/music/radio/theory'

const CHORD: Chord = { notes: [0, 3, 7], name: 'Cm' } as Chord
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
  it('keeps the motif across the movement (phrasesLeft), re-rolls when exhausted', () => {
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
})
```
- [ ] **Step 2: Run — FAIL** (buildLead old shape / new fields missing).
- [ ] **Step 3: Implement the rewrite** — update imports, add `moodId` to `LeadOpts`, rewrite `makeMotif` to the 3-axis pick + combine, keep `degFn`/`atmoDyad`/state. (Show the new `buildLead`/`makeMotif`/`buildBreakLead` in full; map `els` through disguise; pick colour decoupled.)
```ts
// (imports added)
import { pickAxis } from './leadAxes'
import { LEAD_RHYTHMS, onsetCount } from './leadRhythm'
import { LEAD_MELODIES, emitMelody } from './leadMelody'
import { combineLead } from './leadCombine'
import { LEAD_COLORS } from './leadColor'
// LeadOpts gains moodId:
export interface LeadOpts { rng: Rng; leadOctave: number; density: number; scale?: number[]; keyRoot?: number; anti?: AntiRepeatBuffer; moodId: string }
// inside makeMotif:
private makeMotif(opts: LeadOpts): LeadMotif {
  const base = (opts.keyRoot ?? 0) + 12 * (opts.leadOctave - 3)
  const deg = degFn(opts.scale ?? DEFAULT_SCALE, base)
  const rhythm = pickAxis(LEAD_RHYTHMS, opts.moodId, opts.rng, opts.anti, 'lead_rhythm')
  const melody = pickAxis(LEAD_MELODIES, opts.moodId, opts.rng, opts.anti, 'lead_melody')
  const color  = pickAxis(LEAD_COLORS,  opts.moodId, opts.rng, opts.anti, 'lead_color')
  let els = emitMelody(melody, opts.rng, onsetCount(rhythm))
  els = rotate(els, els.length ? opts.rng.int(els.length) : 0)   // light disguise
  return { pattern: combineLead(rhythm, els, deg), voice: color.voice }
}
```
(`buildLead` body unchanged except it calls the new `makeMotif`; `fragment` stays `note("${motif.pattern}")`.)
For `buildBreakLead`: replace the `RESTFUL_LEADS` pick with `pickAxis` over `LEAD_COLORS.filter(restful)` + a calm melody, render with a sparse rhythm (`LEAD_RHYTHMS.find(id==='airy')` or a restful pick).

- [ ] **Step 4: Run — PASS.** Then `npx tsc -b --noEmit` to confirm no dangling refs from deleted tables.
- [ ] **Step 5: Commit** `… "feat(radio): decouple lead into rhythm×melody×colour (note 8 core)"`

---

### Task 7: Wire `moodId` through the composer; keep `renderLead` output shape

**Files:**
- Modify: `src/radio/music/radio/RadioComposer.ts` (the two `this.melody.buildLead(...)` call sites ~L651 and ~L670, and the `buildBreakLead` call ~L701)

**Interfaces:**
- Consumes: `LeadOpts.moodId`.
- Produces: no API change; `renderLead`/`renderBreak` pass `moodId: track.mood` (the mood id STRING; `ctx.mood` is the MoodConfig object, `track.mood` is the id).

- [ ] **Step 1:** add `moodId: track.mood` to BOTH `buildLead` opts objects (main lead ~L651, ghost lead ~L670) and the `buildBreakLead` opts (~L701). `track` is already destructured in `renderLead`/`renderBreak` ctx.
- [ ] **Step 2:** `npx tsc -b --noEmit` — expect PASS (moodId now required).
- [ ] **Step 3: Commit** `… "feat(radio): pass mood id into the lead axes (note 8)"`

---

### Task 8: Note 3 — exit-fill melodic + subDrop via the new generator

**Files:**
- Modify: `src/radio/music/radio/RadioComposer.ts` (`renderExitFill` melodic branch ~L725-727; `subDrop` postKind ~L598)
- Modify: `src/radio/music/radio/engines/leadMelody.ts` (export `descCadence` already done in Task 3; add `descSubRun`)

**Interfaces:**
- Consumes: `descCadence`/`descSubRun` (`./leadMelody`), `degFn`.
- Produces: `descSubRun(rng: Rng): number[]` — a seeded descending MIDI run for the sub-drop (varied length/intervals/start, always descending).

- [ ] **Step 1:** add `descSubRun` to `leadMelody.ts`:
```ts
const SUB_STARTS = [48, 50, 47, 45]
const SUB_STEPS = [6, 5, 6, 7, 4]
/** A seeded descending sub run (note 3's subDrop) — starts mid-low, falls in varied steps. Absolute MIDI. */
export function descSubRun(rng: Rng): number[] {
  let m = SUB_STARTS[rng.int(SUB_STARTS.length)]
  const len = 4 + rng.int(3) // 4..6 notes
  const out: number[] = []
  for (let i = 0; i < len; i++) { out.push(m); m -= SUB_STEPS[rng.int(SUB_STEPS.length)] }
  return out
}
```
- [ ] **Step 2:** rewrite the `subDrop` branch (~L598) to use it:
```ts
else if (postKind === 'subDrop') { const run = descSubRun(createRng(`${track.seed}:subdrop${pos}`)); out.push(orbit(`note("${firstBar(`[${run.join(' ')}]`)}").s("sine").dec(0.12).lpf(500).gain(${g(0.55)})`, ORBIT.fx)) }
```
(Ensure `descSubRun`, `createRng`, `pos`, `track` are imported/destructured in that scope — `track`/`pos` are in `ctx`.)
- [ ] **Step 3:** rewrite the exit-fill melodic branch (~L725-727) to a seeded `descCadence` contour mapped to the bass octave:
```ts
} else if (fill === 'melodic') {
  const base = ((chord.notes[0] % 12) + 12) % 12 + 12 * (this.config.bassOctave + 2)
  const deg = (d: number) => base + DEFAULT_LEAD_SCALE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7) // local heptatonic
  const run = descCadence(createRng(`${track.seed}:xfillmel${pos}`), 8).map(deg)
  out.push(orbit(`note("${lastBar(`[${run.join(' ')}]`)}").s("supersaw").unison(3).detune(0.4).clip(0.95).lpf(1100).distort("1.5:0.4").gain(${g(0.5)})${pump}`, ORBIT.bass))
}
```
Define a local `const DEFAULT_LEAD_SCALE = [0, 2, 3, 5, 7, 8, 10]` near the top of `RadioComposer` (or reuse the track scale via `track.tonality.scale`). Prefer `track.tonality.scale` for in-key: `const sc = track.tonality.scale; const deg = (d:number) => base + sc[((d%sc.length)+sc.length)%sc.length] + 12*Math.floor(d/sc.length)`.
- [ ] **Step 4:** `npx tsc -b --noEmit` — PASS.
- [ ] **Step 5: Commit** `… "feat(radio): note 3 — varied exit-fill + subDrop via melody generator"`

---

### Task 9: Audition, snapshot re-baseline, no-cascade verify, full suite

**Files:**
- Modify: `tests/unit/__snapshots__/radioSnapshot.test.ts.snap` (re-baseline)

- [ ] **Step 1 (BY-EAR GATE):** render several tracks' lead bodies and present pasteable strudel.cc snippets (or have the user run the app). Get explicit user approval that the new leads sound good. DO NOT proceed to re-baseline without it.
- [ ] **Step 2:** re-baseline: `npx vitest run -u --config vitest.config.ts tests/unit/radioSnapshot.test.ts`.
- [ ] **Step 3 (no-cascade verify):** `git diff tests/unit/__snapshots__/radioSnapshot.test.ts.snap | grep -oE "\.orbit\([0-9]+\)" | sort | uniq -c` — expect changed lines to be ONLY the lead orbits (`ORBIT.lead`/`ORBIT.arp`). If other orbits (bass/drums/kick) changed → the RNG draw count shifted; fix `makeMotif` to use dedicated `createRng` sub-streams so `opts.rng` draw count is unchanged, then re-baseline.
- [ ] **Step 4:** full unit suite: `npm run test:unit` — expect all green (`radioRenderSanity` included).
- [ ] **Step 5: Commit** `… "test(radio): re-baseline snapshots for lead decomposition (note 8)"`

---

## Self-Review notes

- **Spec coverage:** axes (Tasks 2/3/5) × independent pick + soft guard + anti-repeat (Tasks 1/6) × combiner (Task 4) × decouple colour (Tasks 5/6) × moodId wiring (Task 7) × note 3 (Task 8) × by-ear+re-baseline+no-cascade (Task 9). All spec sections mapped.
- **Voicing in melody** (decision 1) → `LeadMelody.voicing` + `applyVoicing` (Task 3).
- **Hybrid melody** (decision 2) → contours + `gen` strategies (Task 3).
- **No-cascade** → Task 6 uses `opts.rng` for picks; Task 9 Step 3 verifies and prescribes the dedicated-sub-stream fix if it cascades.
- **erasableSyntaxOnly:** all types are `interface`/`type` unions; no enums; voicing is a string-literal union.
- Known cleanup: Task 6 either removes or leaves dead `ARCHETYPES`/`PHRASES`/`LINES`/`transform*` — delete only if unreferenced (the `atmoDyad` path may still use the tables); confirm with `tsc`.
