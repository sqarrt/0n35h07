# Note 8 Stage 3 — Bass Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the radio bass into three independently-chosen axes — рисунок (mask + accents) × мелодия (semitone-offset contour + drift/shove) × цвет (synth src + fx + filter, incl. the bespoke 303-acid).

**Architecture:** New pure catalog modules under `engines/` (`bassRhythm`, `bassMelody`, `bassColor`) + a `combineBass` combiner, all using the existing `pickAxis`/`MoodTagged`. `chooseStyle` picks the bass triple from a DEDICATED `bassRng` (legacy bass picks stay as rng-stream reserve → no cascade). `renderBass` branches: an `acid:true` colour runs the unchanged `BassEngine` path; every other colour uses combine.

**Tech Stack:** TypeScript 6 (`erasableSyntaxOnly`), vitest, existing `pickAxis`/`MoodTagged`/`createRng`/`AntiRepeatBuffer`/`disguiseCells`.

## Global Constraints

- `erasableSyntaxOnly` — NO enums/namespaces/parameter-properties. String-literal unions only.
- NO magic numbers — named local constants.
- Branch `feature/radio-notes`; version `1.0.0`; do NOT merge.
- **No-cascade rule:** keep the 3 legacy bass `pick()` calls (`st_bass`/`st_bgroove`/`st_bassarch`) consuming `rng`/`anti` at their positions (results stay as legacy TrackStyle fields — the acid path still reads them; the non-acid path ignores them). Pick the real triple from `bassRng = createRng(\`${seed}:bassaxes\`)` (NOT `:bass`, the riff-lock rng in renderBass). Re-baseline must touch ONLY orbit 4 (bass).
- **Offsets are SEMITONES** — `.add(note("<roots>"))` supplies the per-bar root.
- **By-ear gate:** audition basslines, get USER approval BEFORE re-baselining (Task 7).
- Tests run with `dangerouslyDisableSandbox` (WSL). Reuse `pickAxis`/`MoodTagged` from `engines/leadAxes.ts` (tested — don't re-test). Single file: `npx vitest run --config vitest.config.ts tests/unit/<file>`.

---

## File Structure

- Create `engines/bassRhythm.ts` — `BassRhythm` + `BASS_RHYTHMS` + `bassOnsets()`.
- Create `engines/bassMelody.ts` — `BassMelody` + `BASS_MELODIES`.
- Create `engines/bassColor.ts` — `BassColor` + `BASS_COLORS` (`acid:true` = BassEngine).
- Create `engines/combineBass.ts` — `combineBass(rhythm, offs)` → the 16-step offset string.
- Modify `trackStyle.ts` — `TrackStyle` gains `bassRhythm/bassMelody/bassColor`; `chooseStyle(rng, anti, moodId, drumRng, bassRng)`.
- Modify `CompositionScheduler.ts` — pass `createRng(\`${seed}:bassaxes\`)` as the 5th arg.
- Modify `RadioComposer.ts` — `renderBass` branches acid vs combine; delete `BASS_VOICES`/`BassVoice`.
- Tests: `radioBassRhythm.test.ts`, `radioBassMelody.test.ts`, `radioBassColor.test.ts`, `radioCombineBass.test.ts`, `radioBassChoose.test.ts`.

---

### Task 1: `bassRhythm.ts` — mask + accent catalog

**Files:** Create `src/radio/music/radio/engines/bassRhythm.ts`; Test `tests/unit/radioBassRhythm.test.ts`.

**Interfaces:**
- Consumes: `MoodTagged` (`./leadAxes`).
- Produces: `interface BassRhythm extends MoodTagged { mask: string; accent?: string }`; `BASS_RHYTHMS: BassRhythm[]`; `bassOnsets(r: { mask: string }): boolean[]`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { BASS_RHYTHMS, bassOnsets } from '../../src/radio/music/radio/engines/bassRhythm'
describe('bassRhythm', () => {
  it('ids unique, ≥6, every mask has 16 tokens and ≥1 onset (BASS LAW)', () => {
    expect(new Set(BASS_RHYTHMS.map((r) => r.id)).size).toBe(BASS_RHYTHMS.length)
    expect(BASS_RHYTHMS.length).toBeGreaterThanOrEqual(6)
    for (const r of BASS_RHYTHMS) {
      expect(r.mask.trim().split(/\s+/).length).toBe(16)
      expect(bassOnsets(r).some(Boolean)).toBe(true)
    }
  })
  it('accent patterns (when present) have 16 tokens', () => {
    for (const r of BASS_RHYTHMS) if (r.accent) expect(r.accent.trim().split(/\s+/).length).toBe(16)
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
```ts
import type { MoodTagged } from './leadAxes'

// РИСУНОК axis: a 16-step mask — 'x' onset, '_' sustain (hold the previous note), '~' rest. BASS LAW: never all
// rest. Optional 16-step `accent` = a per-step gain pattern (migrated from the voices that carried .gain("…")).
export interface BassRhythm extends MoodTagged { mask: string; accent?: string }
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const ACCENT_A = '1 0.45 0.6 0.5 1 0.45 0.6 0.5 1 0.45 0.7 0.5 1 0.45 0.6 0.5'
const ACCENT_B = '1 0.5 0.7 0.5 1 0.5 0.7 0.5 1 0.5 0.7 0.5 1 0.5 0.7 0.5'
export const BASS_RHYTHMS: BassRhythm[] = [
  { id: 'driving16', mask: 'x x x x x x x x x x x x x x x x' },
  { id: 'straight8', mask: 'x ~ x ~ x ~ x ~ x ~ x ~ x ~ x ~' },
  { id: 'offbeat', mask: '~ x ~ x ~ x ~ x ~ x ~ x ~ x ~ x' },
  { id: 'electro', mask: 'x ~ ~ x x ~ ~ x x ~ ~ x x ~ ~ x' },
  { id: 'rolling', mask: 'x x ~ x x x ~ x x x ~ x x x ~ x', accent: ACCENT_B },
  { id: 'dubSparse', mask: 'x ~ ~ ~ x ~ ~ x ~ ~ x ~ x ~ ~ ~', moods: CALM },
  { id: 'tripletFeel', mask: 'x x x ~ x x x ~ x x x ~ x x x ~' },
  { id: 'sustained', mask: 'x _ _ x _ x _ _ x _ _ x _ x _ _', moods: CALM },
  { id: 'accent16', mask: 'x x x x x x x x x x x x x x x x', accent: ACCENT_A, moods: HARD },
]
export function bassOnsets(r: { mask: string }): boolean[] { return r.mask.trim().split(/\s+/).map((t) => t === 'x') }
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): bass rhythm (mask + accent) catalog (note 8 stage 3)`

---

### Task 2: `bassMelody.ts` — semitone-offset contours

**Files:** Create `src/radio/music/radio/engines/bassMelody.ts`; Test `tests/unit/radioBassMelody.test.ts`.

**Interfaces:**
- Consumes: `MoodTagged`.
- Produces: `interface BassMelody extends MoodTagged { offs: number[]; drift?: boolean; shove?: string }`; `BASS_MELODIES: BassMelody[]`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { BASS_MELODIES } from '../../src/radio/music/radio/engines/bassMelody'
describe('bassMelody', () => {
  it('ids unique, ≥6, every melody has ≥1 offset within ±12 semitones', () => {
    expect(new Set(BASS_MELODIES.map((m) => m.id)).size).toBe(BASS_MELODIES.length)
    expect(BASS_MELODIES.length).toBeGreaterThanOrEqual(6)
    for (const m of BASS_MELODIES) {
      expect(m.offs.length).toBeGreaterThan(0)
      for (const o of m.offs) { expect(o).toBeLessThanOrEqual(12); expect(o).toBeGreaterThanOrEqual(-12) }
    }
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (migrate the `off` offsets from `BASS_VOICES`, rests removed; drift/shove kept):
```ts
import type { MoodTagged } from './leadAxes'

// МЕЛОДИЯ axis: SEMITONE offsets consumed at each rhythm onset (looped). `.add(note("<roots>"))` adds the per-bar
// root downstream. `drift` = a slow downward pitch slide; `shove` = an optional per-bar transpose string.
export interface BassMelody extends MoodTagged { offs: number[]; drift?: boolean; shove?: string }
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
export const BASS_MELODIES: BassMelody[] = [
  { id: 'rootHold', offs: [0] },
  { id: 'tritoneStab', offs: [0, 0, 0, 6, 0, 0, 0, 0], moods: HARD },
  { id: 'fifthDub', offs: [0, 0, 5, 0, 0, 0, 7, 0], moods: CALM },
  { id: 'wtRun', offs: [0, 6, 0, 5, 4, 0] },
  { id: 'minorWalk', offs: [0, 3, 5, 3, 0, -2] },
  { id: 'chromaSlide', offs: [0], drift: true, moods: HARD },
  { id: 'horrorShove', offs: [0], shove: '.add(note("<0 0 6 0>"))', moods: HARD },
  { id: 'octaveBounce', offs: [0, 0, 12, 0], moods: CALM },
]
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): bass melody (offset contour) catalog (note 8 stage 3)`

---

### Task 3: `bassColor.ts` — synth + fx catalog (incl. bespoke acid)

**Files:** Create `src/radio/music/radio/engines/bassColor.ts`; Test `tests/unit/radioBassColor.test.ts`.

**Interfaces:**
- Consumes: `MoodTagged`.
- Produces: `interface BassColor extends MoodTagged { src?: string; fx?: string; filt?: (n: number, lateAlign: string) => string; acid?: boolean }`; `BASS_COLORS: BassColor[]`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { BASS_COLORS } from '../../src/radio/music/radio/engines/bassColor'
describe('bassColor', () => {
  it('ids unique, ≥6, exactly the acid colour carries acid:true', () => {
    expect(new Set(BASS_COLORS.map((c) => c.id)).size).toBe(BASS_COLORS.length)
    expect(BASS_COLORS.length).toBeGreaterThanOrEqual(6)
    expect(BASS_COLORS.filter((c) => c.acid).length).toBe(1)
  })
  it('non-acid colours bring a synth source', () => {
    for (const c of BASS_COLORS) if (!c.acid) expect(typeof c.src === 'string' && c.src.length > 0).toBe(true)
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (migrate `BASS_VOICES.src/fx/filt`, STRIP the positional `.gain("…")` — now in `bassRhythm.accent`):
```ts
import type { MoodTagged } from './leadAxes'

// ЦВЕТ axis: synth source + fx character + optional filter. `acid:true` = the bespoke 303 path (BassEngine), which
// ignores the rhythm/melody axes. Positional accents were moved to bassRhythm.accent, so these fx are accent-free.
export interface BassColor extends MoodTagged {
  src?: string; fx?: string; filt?: (n: number, lateAlign: string) => string; acid?: boolean
}
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
export const BASS_COLORS: BassColor[] = [
  { id: 'acid', acid: true },   // bespoke — runs BassEngine with its own root-pulse melody/rhythm
  { id: 'supersawDrive', src: '.s("supersaw").unison(5).detune(0.4)', fx: '.acidenv(0.7).lpq(9).distort("1.2:0.3")' },
  { id: 'bitcrush', src: '.s("supersaw").unison(3).detune(0.4)', fx: '.crush(4).distort("1.3:0.45").release(0.14).lpq(5).acidenv(0.4)', moods: HARD },
  { id: 'wobble', src: '.s("supersaw").unison(5).detune(0.5)', fx: '.lpq(13).distort("1.4:0.45")', filt: (n, la) => `.lpf(sine.range(160, 1700).slow(${Math.max(2, n)})${la})` },
  { id: 'chromaSaw', src: '.s("supersaw").unison(5).detune(0.45).fm(2).fmh(2.51)', fx: '.lpq(6).distort("1.4:0.45")', filt: (_n, la) => `.lpf(saw.range(200, 1100).slow(2)${la})`, moods: HARD },
  { id: 'horror', src: '.s("supersaw").unison(3).detune(0.4)', fx: '.ply("<1 1 2 1 1 3 1 2>").crush("<8 5 8 4>").distort("1.5:0.5").lpq(7)', filt: () => '.lpf(perlin.range(220, 1700).fast(2))', moods: HARD },
  { id: 'wtFlute', src: '.s("wt_flute").unison(2)', fx: '.wt(0).wtenv(0.7).acidenv(0.45).distort("4:0.5").dec(0.13).lpq(2).fm("<1 ~ ~ 2>")', moods: CALM },
  { id: 'wtDigital', src: '.s("wt_digital").unison(2)', fx: '.wt(0).wtenv(0.5).acidenv(0.4).distort("3:0.4").dec(0.15).lpq(4)' },
  { id: 'cleanSub', src: '.s("sawtooth")', fx: '.lpq(3)', moods: CALM },
]
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): bass colour catalog incl. bespoke acid (note 8 stage 3)`

---

### Task 4: `combineBass.ts` — rhythm × melody → offset string

**Files:** Create `src/radio/music/radio/engines/combineBass.ts`; Test `tests/unit/radioCombineBass.test.ts`.

**Interfaces:**
- Consumes: `BassRhythm`/`bassOnsets` (`./bassRhythm`).
- Produces: `combineBass(rhythm: { mask: string }, offs: number[]): string` → 16 space-joined tokens (`x`→next offset looped, `_`→`_`, `~`→`~`).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { combineBass } from '../../src/radio/music/radio/engines/combineBass'
describe('combineBass', () => {
  it('places offsets on onsets, _ on sustain, ~ on rest', () => {
    const r = { mask: 'x _ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~' }
    expect(combineBass(r, [0, 6])).toBe('0 _ ~ 6 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~')
  })
  it('loops the offset contour across onsets', () => {
    const r = { mask: 'x x x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~' }
    expect(combineBass(r, [0, 5]).startsWith('0 5 0 ~')).toBe(true)
  })
  it('always returns 16 tokens', () => {
    expect(combineBass({ mask: 'x x x x x x x x x x x x x x x x' }, [0]).split(' ').length).toBe(16)
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
```ts
import { bassOnsets, type BassRhythm } from './bassRhythm'

/** Lay the semitone-offset contour onto the rhythm mask → a 16-token pattern ('x'→next offset looped, '_'/'~' kept). */
export function combineBass(rhythm: Pick<BassRhythm, 'mask'>, offs: number[]): string {
  const tokens = rhythm.mask.trim().split(/\s+/)
  let k = 0
  return tokens.map((t) => {
    if (t === 'x') { const v = offs[k % offs.length]; k++; return String(v) }
    return t // '_' sustain or '~' rest
  }).join(' ')
}
// bassOnsets is re-exported for symmetry with the other axes (used by tests/tools).
export { bassOnsets }
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): bass rhythm×melody combiner (note 8 stage 3)`

---

### Task 5: `chooseStyle` picks the bass triple from a dedicated rng

**Files:** Modify `src/radio/music/radio/trackStyle.ts`; Modify `src/radio/music/radio/CompositionScheduler.ts`; Test `tests/unit/radioBassChoose.test.ts`.

**Interfaces:**
- Consumes: `pickAxis`, `BASS_RHYTHMS`/`BassRhythm`, `BASS_MELODIES`/`BassMelody`, `BASS_COLORS`/`BassColor`, `Rng`.
- Produces: `TrackStyle` gains `bassRhythm: BassRhythm; bassMelody: BassMelody; bassColor: BassColor`; `chooseStyle(rng, anti, moodId, drumRng, bassRng)`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { chooseStyle } from '../../src/radio/music/radio/trackStyle'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'
const mk = (seed: string, mood = 'dark_techno') =>
  chooseStyle(createRng(seed), new AntiRepeatBuffer(3), mood, createRng(seed + ':drums'), createRng(seed + ':bassaxes'))
describe('chooseStyle bass', () => {
  it('picks a full bass triple', () => {
    const s = mk('T')
    expect(s.bassRhythm.id.length).toBeGreaterThan(0)
    expect(s.bassMelody.id.length).toBeGreaterThan(0)
    expect(s.bassColor.id.length).toBeGreaterThan(0)
  })
  it('respects the mood guard — a HARD-only colour never appears under a calm mood', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 120; i++) ids.add(mk('m' + i, 'dark_ambient').bassColor.id)
    expect(ids.has('bitcrush')).toBe(false)   // bitcrush is HARD-tagged
    expect(ids.size).toBeGreaterThan(2)
  })
})
```
- [ ] **Step 2: Run — FAIL** (arity / missing fields).
- [ ] **Step 3: Implement:** add the imports (`pickAxis` already imported in stage 2; add the 3 bass catalogs); extend `TrackStyle` with the 3 fields (annotate the legacy `bassSound/bassFm/bassRest/bassGroove/bassArchetype` as kept for rng reserve / the acid path); change `chooseStyle` signature to `(rng, anti, moodId, drumRng, bassRng)`; ADD to the returned object:
```ts
    bassRhythm: pickAxis(BASS_RHYTHMS, moodId, bassRng, anti, 'bass_rhythm'),
    bassMelody: pickAxis(BASS_MELODIES, moodId, bassRng, anti, 'bass_melody'),
    bassColor: pickAxis(BASS_COLORS, moodId, bassRng, anti, 'bass_color'),
```
Then in `CompositionScheduler.buildTrack` change the call to:
```ts
    const style = chooseStyle(rng, this.anti, mood, createRng(`${seed}:drums`), createRng(`${seed}:bassaxes`))
```
- [ ] **Step 4: Run — PASS.** Then `npx tsc -b --noEmit` (renderBass still reads legacy fields → compiles).
- [ ] **Step 5: Commit** `feat(radio): choose the bass triple from a dedicated rng (note 8 stage 3)`

---

### Task 6: `renderBass` branches acid vs combine; delete `BASS_VOICES`

**Files:** Modify `src/radio/music/radio/RadioComposer.ts` (`renderBass` ~L483-545; delete `BassVoice` + `BASS_VOICES` ~L820-826; `BassArchetype` import if dead).

**Interfaces:**
- Consumes: `combineBass` (`./engines/combineBass`), `style.bassRhythm/bassMelody/bassColor`.

- [ ] **Step 1:** import `combineBass` from `./engines/combineBass`. Replace the `if (style.bassArchetype === 'existing') { … } else { … BASS_VOICES … }` block. The ACID branch is the OLD `existing` body verbatim (it reads `style.bassGroove`/`bassSound`/`bassFm`/`bassRest` — the legacy fields, still populated). The NON-acid branch is the combine:
```ts
      let bassMain: string
      if (style.bassColor.acid) {
        // 303 acid — the bespoke path (unchanged): root-pulse + acidenv squelch from the legacy fields.
        const groove = style.bassGroove.split(/\s+/).map((t) => t !== '~')
        const aRng = createRng(`${track.seed}:aenv${pos}`)
        const center = Math.min(0.6, Math.max(0.12, 0.3 + 0.25 * blockProgress + (this.drift.acidenv - 0.4) * 0.25 + mut.acidenv))
        const amp = muffled ? 0.08 : 0.16
        const aHi = r2(Math.min(0.65, center + amp)); const aLo = r2(Math.max(0.12, center - amp))
        const motion = (['rise', 'fall', 'sine', 'jump'] as const)[aRng.int(4)]
        let acidenvExpr: string
        if (motion === 'rise') acidenvExpr = `saw.range(${aLo}, ${aHi}).slow(${n})`
        else if (motion === 'fall') acidenvExpr = `saw.range(${aHi}, ${aLo}).slow(${n})`
        else if (motion === 'sine') acidenvExpr = `sine.range(${aLo}, ${aHi}).slow(${n})`
        else acidenvExpr = `"<${Array.from({ length: n }, () => r2(aLo + aRng.next() * (aHi - aLo))).join(' ')}>"`
        const frag = this.bass.buildBass({
          rng: bassRng, roots, sound: style.bassSound, rest: style.bassRest, groove,
          saturation: muffled ? 0.08 : r2((0.3 + mood.fx.saturation * 0.3) * mut.drive), acidenv: acidenvExpr,
          dec: r2(0.16 * mut.env),
        })
        const fm = style.bassFm > 0 ? `.fm(${r2(style.bassFm * mut.fm)}).fmh(2)` : ''
        const fat = muffled ? '' : '.superimpose(x => x.add(note(12)).s("square").distort("1.5:0.4").gain(0.34).lpf(1400))'
        const wide = !muffled && style.bassSound === 'supersaw' ? `.unison(5).detune(${r2(0.5 * mut.width)})` : ''
        bassMain = `${frag}${wide}.clip(0.95).lpf(${bassLpf})${fm}${fat}${bassSuper}`
      } else {
        // note 8: рисунок × мелодия × цвет, transposed onto the progression roots.
        const r = style.bassRhythm, m = style.bassMelody, c = style.bassColor
        const combined = combineBass(r, m.offs)
        // disguise (cell reorder) per track — but SKIP it when an accent pattern is present, else the fixed-position
        // accents would mis-align with the reordered onsets (the original BASS_VOICES code had the same guard).
        const off = r.accent ? combined : disguiseCells(combined, createRng(`${track.seed}:bassdis`))
        const accent = r.accent ? `.gain("${r.accent}")` : ''
        const drift = m.drift ? `.add(note(saw.range(0, -12).slow(${n})${lateAlign}))` : ''
        const filt = c.filt ? c.filt(n, lateAlign) : `.lpf(${bassLpf})`
        bassMain = `note("${off}")${m.shove ?? ''}.add(note("<${roots.join(' ')}>"))${drift}${c.src ?? ''}${c.fx ?? ''}${accent}.clip(0.95)${filt}${bassSuper}`
      }
```
- [ ] **Step 2:** delete the `BassVoice` interface + `BASS_VOICES` const (~L820-826). Remove the now-dead `BassArchetype` import from RadioComposer if unused (`style.bassArchetype` is no longer read). `npx tsc -b --noEmit` — resolve dead refs.
- [ ] **Step 3:** `npx vitest run --config vitest.config.ts tests/unit/radioRenderSanity.test.ts` — PASS.
- [ ] **Step 4: Commit** `feat(radio): renderBass branches acid vs rhythm×melody×colour; drop BASS_VOICES (note 8 stage 3)`

---

### Task 7: Audition, snapshot re-baseline, no-cascade verify, full suite

**Files:** Modify `tests/unit/__snapshots__/radioSnapshot.test.ts.snap`.

- [ ] **Step 1 (BY-EAR GATE):** render several tracks' bass lines (orbit 4), present pasteable strudel.cc snippets (a few combined basslines across colours/rhythms + one acid). Get explicit USER approval. DO NOT re-baseline without it.
- [ ] **Step 2:** re-baseline: `npx vitest run -u --config vitest.config.ts tests/unit/radioSnapshot.test.ts`.
- [ ] **Step 3 (no-cascade verify):** `git diff …radioSnapshot.test.ts.snap | grep -oE "\.orbit\([0-9]+\)" | sort | uniq -c` — expect ONLY `.orbit(4)`. If `.orbit(2/3/6/7/8/9)` appear → the bassRng isolation leaked (the legacy bass picks weren't preserved); fix, then re-baseline.
- [ ] **Step 4:** `npm run test:unit` — all green.
- [ ] **Step 5: Commit** `test(radio): re-baseline snapshots for bass decomposition (note 8 stage 3)`

---

## Self-Review notes

- **Spec coverage:** рисунок+accents (Task 1) × мелодия+drift/shove (Task 2) × цвет incl. bespoke acid (Task 3) × combiner (Task 4) × selection+mood-guard+no-cascade (Task 5) × render acid/combine + cleanup (Task 6) × audition+re-baseline+verify (Task 7). All mapped.
- **No-cascade:** Task 5 keeps the legacy bass picks; the triple comes from `:bassaxes` (distinct from the `:bass` riff rng). Task 7 Step 3 verifies (only orbit 4).
- **Acid bespoke:** Task 6 acid branch is the old `existing` body verbatim, reading the legacy fields (still populated).
- **erasableSyntaxOnly:** all `interface`/`type`; the motion `as const` tuple is a value, fine.
- **Type consistency:** `BassRhythm/BassMelody/BassColor`, `combineBass`, `bassOnsets` used identically across tasks.
