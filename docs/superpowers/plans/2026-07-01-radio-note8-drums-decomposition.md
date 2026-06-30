# Note 8 Stage 2 — Drums Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the radio drums into three independently-chosen axes — рисунок (groove) × набор (kit/bank) × цвет (per-track processing, note 4) — so the kick/drum SOUND varies per track while the groove keeps its existing variety.

**Architecture:** New pure catalog modules under `engines/` (`drumRhythm`, `drumKit`, `drumColor`), each `extends MoodTagged` and picked by the existing `engines/leadAxes.pickAxis`. `chooseStyle` picks the drum triple from a DEDICATED `drumRng` (the legacy drum picks stay as rng-stream reserve, so no cascade into other style fields). `renderKick`/`renderPerc` read `style.drumRhythm/drumKit/drumColor`.

**Tech Stack:** TypeScript 6 (`erasableSyntaxOnly`), vitest, existing `pickAxis`/`MoodTagged`/`createRng`/`AntiRepeatBuffer`.

## Global Constraints

- `erasableSyntaxOnly` — NO enums/namespaces/parameter-properties. String-literal unions only.
- NO magic numbers — named local constants.
- Branch `feature/radio-notes`; version `1.0.0`; do NOT merge.
- **No-cascade rule:** the main `rng` stream in `chooseStyle` must stay byte-identical for all NON-drum fields. Keep the 6 legacy drum `pick()` calls (`st_kickvoice/st_kick/st_clap/st_hat/st_swing/st_drumarch`) consuming `rng` at their current positions (results discarded). Pick the real triple from `drumRng = createRng(\`${seed}:drums\`)`. Re-baseline must touch ONLY orbits 2 (kicks) / 3 (perc) / 7 (snare).
- **By-ear gate:** audition kick colours + kits and get USER approval BEFORE re-baselining (Task 7).
- Tests run with `dangerouslyDisableSandbox` (WSL). Single file: `npx vitest run --config vitest.config.ts tests/unit/<file>`.
- Reuse `pickAxis`/`MoodTagged` from `engines/leadAxes.ts` (already tested — do NOT re-test pickAxis).

---

## File Structure

- Create `engines/drumRhythm.ts` — `DrumRhythm` + `DRUM_RHYTHMS` (migrates `DRUM_KITS` + `KICK`/`HAT`/`CLAP`/`SWING`).
- Create `engines/drumKit.ts` — `DrumKit` + `DRUM_KITS_SND` (migrates `KICK_VOICES` → whole-kit banks) + `kitBankOf()`.
- Create `engines/drumColor.ts` — `DrumColor` + `DRUM_COLORS` (new processing presets, note 4) + `kickColorChain()`.
- Modify `trackStyle.ts` — `TrackStyle` gains `drumRhythm/drumKit/drumColor`; `chooseStyle` gains `(…, moodId, drumRng)`.
- Modify `CompositionScheduler.ts:96-114` — `buildTrack` passes `mood` + `createRng(\`${seed}:drums\`)` into `chooseStyle`.
- Modify `RadioComposer.ts` — `renderKick`/`renderPerc` read the new triple; drop `ctx.drumKit`/`DRUM_KITS`.
- Tests: `tests/unit/radioDrumRhythm.test.ts`, `radioDrumKit.test.ts`, `radioDrumColor.test.ts`, `radioDrumChoose.test.ts`.

---

### Task 1: `drumRhythm.ts` — groove catalog

**Files:** Create `src/radio/music/radio/engines/drumRhythm.ts`; Test `tests/unit/radioDrumRhythm.test.ts`.

**Interfaces:**
- Consumes: `MoodTagged` (`./leadAxes`).
- Produces: `interface DrumRhythm extends MoodTagged { kick: string; hat: string; snare: string; clap: string; ghost?: string; rim?: string; swing: number }`; `DRUM_RHYTHMS: DrumRhythm[]`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { DRUM_RHYTHMS } from '../../src/radio/music/radio/engines/drumRhythm'
describe('drumRhythm', () => {
  it('ids unique, ≥6 grooves', () => {
    expect(new Set(DRUM_RHYTHMS.map((r) => r.id)).size).toBe(DRUM_RHYTHMS.length)
    expect(DRUM_RHYTHMS.length).toBeGreaterThanOrEqual(6)
  })
  it('every groove defines the four core layers + swing', () => {
    for (const r of DRUM_RHYTHMS) {
      for (const p of [r.kick, r.hat, r.snare, r.clap]) expect(typeof p === 'string' && p.length > 0).toBe(true)
      expect(typeof r.swing).toBe('number')
    }
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (migrate the co-designed `DRUM_KITS` + a few four-floor variants from `KICK`/`HAT`/`CLAP`):
```ts
import type { MoodTagged } from './leadAxes'

// РИСУНОК axis: the groove — kick/hat/snare/clap step patterns + swing (+ optional ghost/rim layers). Migrated from
// the old DRUM_KITS (amen/industrial/broken/minimal) and the four-floor KICK/HAT/CLAP pools. Decoupled from SOUND.
export interface DrumRhythm extends MoodTagged {
  kick: string; hat: string; snare: string; clap: string
  ghost?: string; rim?: string; swing: number
}
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
export const DRUM_RHYTHMS: DrumRhythm[] = [
  { id: 'amen', kick: 'bd ~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~', hat: 'hh*16', snare: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd ~', clap: '~ cp ~ cp', ghost: '~ ~ sd ~ ~ sd ~ ~ ~ sd ~ ~ ~ sd ~ ~', swing: 0.06 },
  { id: 'industrial', kick: 'bd*4', hat: 'white*16', snare: '~ cp ~ cp', clap: '~ cp ~ cp', swing: 0, moods: HARD },
  { id: 'broken', kick: 'bd ~ ~ bd ~ ~ bd ~ ~ bd ~ bd ~ ~ bd ~', hat: 'hh*16', snare: '~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ cp', clap: '~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ cp', swing: 0.13 },
  { id: 'minimal', kick: 'bd*4', hat: '~ hh ~ hh', snare: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', clap: '~ cp ~ cp', rim: '~ rim ~ rim', swing: 0 },
  { id: 'fourFloor', kick: 'bd*4', hat: 'hh*8', snare: '~ sd ~ sd', clap: '~ cp ~ cp', swing: 0 },
  { id: 'fourOff', kick: 'bd*4', hat: 'hh ~ hh ~ hh ~ hh hh', snare: '~ sd ~ sd', clap: '~ cp ~ [cp cp]', swing: 0 },
  { id: 'rollingDub', kick: 'bd ~ ~ bd ~ ~ bd ~', hat: '[hh hh] hh hh hh', snare: '~ ~ ~ sd', clap: '~ ~ cp ~', rim: '~ rim ~ rim', swing: 0.05, moods: CALM },
  { id: 'euclid', kick: 'bd(5,8)', hat: 'hh*12', snare: '~ ~ sd ~', clap: '~ cp', swing: 0 },
  { id: 'sparseHyp', kick: 'bd ~ ~ bd ~ ~ bd ~', hat: '~ hh ~ hh', snare: '~ ~ ~ ~ ~ ~ sd ~', clap: '~ ~ ~ cp', swing: 0, moods: CALM },
]
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): drum groove catalog (note 8 stage 2)`

---

### Task 2: `drumKit.ts` — sample-kit (bank) catalog

**Files:** Create `src/radio/music/radio/engines/drumKit.ts`; Test `tests/unit/radioDrumKit.test.ts`.

**Interfaces:**
- Consumes: `MoodTagged`.
- Produces: `interface DrumKit extends MoodTagged { kickBank: string; kickN: number; snareBank?: string; hatBank?: string; clapBank?: string }`; `DRUM_KITS_SND: DrumKit[]`; `kitBankOf(kit: DrumKit, drum: 'snare'|'hat'|'clap'): string` (returns the drum's bank, defaulting to `kickBank`).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { DRUM_KITS_SND, kitBankOf } from '../../src/radio/music/radio/engines/drumKit'
describe('drumKit', () => {
  it('ids unique, ≥6 kits', () => {
    expect(new Set(DRUM_KITS_SND.map((k) => k.id)).size).toBe(DRUM_KITS_SND.length)
    expect(DRUM_KITS_SND.length).toBeGreaterThanOrEqual(6)
  })
  it('kitBankOf defaults a drum to the kick bank when unset (coherent kit)', () => {
    expect(kitBankOf({ id: 'x', kickBank: 'RolandTR909', kickN: 0 }, 'snare')).toBe('RolandTR909')
    expect(kitBankOf({ id: 'h', kickBank: 'RolandTR808', kickN: 0, hatBank: 'RolandTR909' }, 'hat')).toBe('RolandTR909')
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (migrate `KICK_VOICES`; coherent single-bank kits + 2 hybrids; `''` bank = default dirt/EmuSP12):
```ts
import type { MoodTagged } from './leadAxes'

// НАБОР axis: which sample bank renders the whole kit (kick + snare + hat + clap). Coherent kits set one bank;
// hybrids override per drum. An empty bank = the default dirt/EmuSP12 samples (the legacy sound). Migrated from
// the kick-only KICK_VOICES — now the bank applies to the whole kit.
export interface DrumKit extends MoodTagged {
  kickBank: string; kickN: number
  snareBank?: string; hatBank?: string; clapBank?: string
}
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
export const DRUM_KITS_SND: DrumKit[] = [
  { id: 'tr909', kickBank: 'RolandTR909', kickN: 0 },
  { id: 'tr808', kickBank: 'RolandTR808', kickN: 0, moods: [...CALM, 'dark_techno'] },
  { id: 'tr707', kickBank: 'RolandTR707', kickN: 0 },
  { id: 'tr606', kickBank: 'RolandTR606', kickN: 0, moods: HARD },
  { id: 'tr505', kickBank: 'RolandTR505', kickN: 0 },
  { id: 'linn', kickBank: 'AkaiLinn', kickN: 0 },
  { id: 'dirt', kickBank: '', kickN: 0 },            // the original dirt bd kit
  { id: 'dirtB', kickBank: '', kickN: 5 },           // dirt bd variant
  { id: 'hybrid808x909', kickBank: 'RolandTR808', kickN: 0, hatBank: 'RolandTR909', clapBank: 'RolandTR909' },
  { id: 'hybrid606dirt', kickBank: 'RolandTR606', kickN: 0, snareBank: '', hatBank: '', moods: HARD },
]
export function kitBankOf(kit: DrumKit, drum: 'snare' | 'hat' | 'clap'): string {
  const b = drum === 'snare' ? kit.snareBank : drum === 'hat' ? kit.hatBank : kit.clapBank
  return b ?? kit.kickBank
}
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): drum sample-kit (bank) catalog (note 8 stage 2)`

---

### Task 3: `drumColor.ts` — per-track processing presets (note 4)

**Files:** Create `src/radio/music/radio/engines/drumColor.ts`; Test `tests/unit/radioDrumColor.test.ts`.

**Interfaces:**
- Consumes: `MoodTagged`.
- Produces: `interface DrumColor extends MoodTagged { kickShape: number; kickDrive?: string; kickDecay?: number; kickLpf?: number; kickClick?: boolean; drumShape?: number; room?: number }`; `DRUM_COLORS: DrumColor[]`; `kickColorChain(c: DrumColor): string` (the Strudel suffix for the kick's colour, e.g. `.shape(0.3).distort("1.2:0.3").decay(0.18).lpf(1200)`).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { DRUM_COLORS, kickColorChain } from '../../src/radio/music/radio/engines/drumColor'
describe('drumColor', () => {
  it('ids unique, ≥6 colours', () => {
    expect(new Set(DRUM_COLORS.map((c) => c.id)).size).toBe(DRUM_COLORS.length)
    expect(DRUM_COLORS.length).toBeGreaterThanOrEqual(6)
  })
  it('kickColorChain always sets shape and is method-suffix shaped', () => {
    for (const c of DRUM_COLORS) {
      const chain = kickColorChain(c)
      expect(chain.startsWith('.shape(')).toBe(true)
      expect(chain.includes('NaN')).toBe(false)
    }
  })
  it('drive/decay/lpf appear only when defined', () => {
    expect(kickColorChain({ id: 't', kickShape: 0.2 })).toBe('.shape(0.2)')
    expect(kickColorChain({ id: 'd', kickShape: 0.2, kickDecay: 0.18, kickLpf: 1200 })).toBe('.shape(0.2).decay(0.18).lpf(1200)')
  })
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (noticeable, in-genre kick characters):
```ts
import type { MoodTagged } from './leadAxes'

// ЦВЕТ axis (note 4): the per-track kick/drum PROCESSING character. Noticeable but in-genre. kickColorChain builds
// the Strudel suffix; the composer appends the section/mood modulation (gain envelope, muffle, peak) AROUND it.
export interface DrumColor extends MoodTagged {
  kickShape: number; kickDrive?: string; kickDecay?: number; kickLpf?: number; kickClick?: boolean
  drumShape?: number; room?: number
}
const HARD = ['dark_techno', 'hard_techno', 'acid', 'acid_dark', 'industrial']
const CALM = ['dark_ambient', 'dub_techno', 'dark_hypnotic']
export const DRUM_COLORS: DrumColor[] = [
  { id: 'punchy', kickShape: 0.22, kickClick: true, drumShape: 0.06 },
  { id: 'boomySub', kickShape: 0.12, kickDecay: 0.26, kickLpf: 700, drumShape: 0.04, moods: [...CALM, 'dark_techno'] },
  { id: 'crunchy', kickShape: 0.38, kickDrive: '1.3:0.35', drumShape: 0.12, moods: HARD },
  { id: 'tightDry', kickShape: 0.18, kickDecay: 0.1, kickClick: true },
  { id: 'lofiCrush', kickShape: 0.3, kickDrive: '1.2:0.3', kickLpf: 1500, drumShape: 0.1, room: 0.12, moods: HARD },
  { id: 'gatedShort', kickShape: 0.26, kickDecay: 0.08, kickLpf: 2000, kickClick: true },
  { id: 'roundWarm', kickShape: 0.1, kickDecay: 0.2, kickLpf: 900, room: 0.08, moods: CALM },
  { id: 'hardDrive', kickShape: 0.34, kickDrive: '1.4:0.4', kickClick: true, drumShape: 0.14, moods: HARD },
]
const CLICK_SUFFIX = '.attack(0.001)' // a hard, immediate transient (no soft fade) reads as punch
/** The kick's colour suffix: shape, optional drive/decay/lpf/click. Order is fixed for snapshot stability. */
export function kickColorChain(c: DrumColor): string {
  let s = `.shape(${c.kickShape})`
  if (c.kickDrive) s += `.distort("${c.kickDrive}")`
  if (c.kickDecay !== undefined) s += `.decay(${c.kickDecay})`
  if (c.kickLpf !== undefined) s += `.lpf(${c.kickLpf})`
  if (c.kickClick) s += CLICK_SUFFIX
  return s
}
```
- [ ] **Step 4: Run — PASS.**  **Step 5: Commit** `feat(radio): drum colour (kick processing) catalog — note 4 (stage 2)`

---

### Task 4: `chooseStyle` picks the drum triple from a dedicated rng (no cascade)

**Files:** Modify `src/radio/music/radio/trackStyle.ts`; Modify `src/radio/music/radio/CompositionScheduler.ts:108`; Test `tests/unit/radioDrumChoose.test.ts`.

**Interfaces:**
- Consumes: `pickAxis` (`./engines/leadAxes`), `DRUM_RHYTHMS`/`DrumRhythm`, `DRUM_KITS_SND`/`DrumKit`, `DRUM_COLORS`/`DrumColor`, `Rng`/`createRng`.
- Produces: `TrackStyle` gains `drumRhythm: DrumRhythm; drumKit: DrumKit; drumColor: DrumColor`; `chooseStyle(rng: Rng, anti: AntiRepeatBuffer, moodId: string, drumRng: Rng): TrackStyle`.

**No-cascade:** keep the 6 legacy drum `pick()` calls in `chooseStyle` (they still consume `rng` and `anti` exactly — discard nothing structurally, the fields stay in TrackStyle as legacy/unused). ADD the three new fields picked from `drumRng`. The main `rng` stream is byte-identical → non-drum fields unchanged.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { chooseStyle } from '../../src/radio/music/radio/trackStyle'
import { AntiRepeatBuffer } from '../../src/radio/music/radio/AntiRepeatBuffer'
import { createRng } from '../../src/radio/music/seededRandom'
const mk = (seed: string, mood = 'dark_techno') =>
  chooseStyle(createRng(seed), new AntiRepeatBuffer(3), mood, createRng(seed + ':drums'))
describe('chooseStyle drums', () => {
  it('picks a full drum triple', () => {
    const s = mk('T')
    expect(s.drumRhythm.id.length).toBeGreaterThan(0)
    expect(s.drumKit.id.length).toBeGreaterThan(0)
    expect(s.drumColor.id.length).toBeGreaterThan(0)
  })
  it('is deterministic per seed', () => {
    expect(mk('T').drumColor.id).toBe(mk('T').drumColor.id)
  })
  it('respects the mood guard — a HARD-only colour never appears under a calm mood', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 120; i++) ids.add(mk('m' + i, 'dark_ambient').drumColor.id)
    expect(ids.has('crunchy')).toBe(false)   // crunchy is HARD-tagged
    expect(ids.size).toBeGreaterThan(2)
  })
})
```
- [ ] **Step 2: Run — FAIL** (chooseStyle arity / missing fields).
- [ ] **Step 3: Implement:** add the imports; extend `TrackStyle` with the three fields (keep the legacy `kickVoice/kickPat/clapPat/hatPat/swing/drumArchetype` — annotate `// legacy: kept so chooseStyle's rng stream stays aligned; unused by the renderer`); change `chooseStyle` signature to `(rng, anti, moodId, drumRng)`; inside the returned object ADD:
```ts
    drumRhythm: pickAxis(DRUM_RHYTHMS, moodId, drumRng, anti, 'drum_rhythm'),
    drumKit: pickAxis(DRUM_KITS_SND, moodId, drumRng, anti, 'drum_kit'),
    drumColor: pickAxis(DRUM_COLORS, moodId, drumRng, anti, 'drum_color'),
```
Then in `CompositionScheduler.buildTrack` (L108) replace `const style = chooseStyle(rng, this.anti)` with:
```ts
    const seed = `${this.sessionSeed}:t${index}`
    const style = chooseStyle(rng, this.anti, mood, createRng(`${seed}:drums`))
```
and reuse `seed` in the returned `TrackPlan` (replace the inline `seed: \`${this.sessionSeed}:t${index}\``). Import `createRng` in CompositionScheduler if not already.
- [ ] **Step 4: Run — PASS.** Then `npx tsc -b --noEmit` (renderKick/renderPerc still read legacy fields → still compiles; the new fields exist).
- [ ] **Step 5: Commit** `feat(radio): choose the drum triple from a dedicated rng (note 8 stage 2)`

---

### Task 5: `renderKick` reads drumRhythm/drumKit/drumColor

**Files:** Modify `src/radio/music/radio/RadioComposer.ts` (`renderKick` ~L431-451; the `drumKit` ctx field ~L372).

**Behaviour:** kick base pattern from `style.drumRhythm.kick` (deep/boundary/kickDrop/fill logic unchanged); bank from `style.drumKit.kickBank/kickN`; colour base from `kickColorChain(style.drumColor)` then the section/mood modulation (energyEnv gain, muffled lpf, peak shape bump) layered AFTER. `drumRhythm.swing`/`shape` previously from DRUM_KITS now come from the rhythm/colour.

- [ ] **Step 1:** import `kickColorChain` from `./engines/drumColor`. Rewrite the kick block:
```ts
  private renderKick(ctx: SectionContext): string[] {
    const { shape, role, mood, style, preKind, boundaryOut, fillNext, lastN, seqAligned, peak, muffled, energyEnv, drums, dropDuck, exitDuck } = ctx
    const out: string[] = []
    if (shape.layers.kicks) {
      const deep = role === 'break'
      const base = deep ? 'bd*4' : style.drumRhythm.kick
      let kickPat = base
      if (preKind === 'kickDrop') kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~'])
      else if (boundaryOut) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), fillNext ? '[bd*2 bd bd bd]' : '[bd bd bd bd]'])
      else if (deep) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~'])
      const PEAK_SHAPE_BUMP = 0.12
      const kickShape = r2(style.drumColor.kickShape + (peak ? PEAK_SHAPE_BUMP : 0))
      const kickGain = r2(MASTER * MIX.kick * energyEnv * (muffled ? 0.85 : deep ? 0.92 : 1))
      const colour = kickColorChain(style.drumColor)
      const sectionLpf = deep ? '.lpf(1500)' : muffled ? '.lpf(900)' : '' // section override on top of the colour
      const kit = style.drumKit
      const kvoice = (kit.kickBank ? `.bank("${kit.kickBank}")` : '') + `.n(${kit.kickN})`
      out.push(orbit(`s("${kickPat}")${kvoice}.gain("${drums.gain}")${colour}.shape(${kickShape}).gain(${kickGain})${sectionLpf}${dropDuck}${exitDuck}`, ORBIT.kicks))
    }
    return out
  }
```
(Note: `kickColorChain` already emits a `.shape(base)`; the extra `.shape(${kickShape})` adds the peak bump on top — two `.shape()` calls stack in Strudel. If you prefer one, fold the bump into `kickColorChain`'s input — but keep them separate for snapshot clarity.)
- [ ] **Step 2:** remove the now-unused `drumKit` from the `renderKick` destructure (done above) and from `SectionContext` build (L372 `const drumKit = …` and L376/L97 field) — see Task 6 which also uses it; remove only after Task 6.
- [ ] **Step 3:** `npx tsc -b --noEmit` — expect PASS (ctx.drumKit may still exist, used by renderPerc until Task 6).
- [ ] **Step 4: Commit** `feat(radio): renderKick reads drum rhythm/kit/colour (note 8 stage 2)`

---

### Task 6: `renderPerc` reads drumRhythm/drumKit; drop `ctx.drumKit`/`DRUM_KITS`

**Files:** Modify `src/radio/music/radio/RadioComposer.ts` (`renderPerc` ~L551-578; `SectionContext.drumKit` field ~L97; ctx build ~L372,376; delete `DRUM_KITS` ~L817 and `import { type DrumKit }`/`DrumArchetype` usage if now dead).

- [ ] **Step 1:** import `kitBankOf` from `./engines/drumKit`. Rewrite `renderPerc` layers to read `style.drumRhythm` + apply banks:
```ts
      const dr = style.drumRhythm, kit = style.drumKit, dc = style.drumColor
      const bankOf = (drum: 'snare' | 'hat' | 'clap') => { const b = kitBankOf(kit, drum); return b ? `.bank("${b}")` : '' }
      const hatPat = role === 'break' ? '[hh ~]*2' : dr.hat
      const hatGain = role === 'break' ? MIX.hat * 0.7 : MIX.hat
      const swing = Math.max(0, dr.swing + mut.swing)
      const hats = `s("${hatPat}")${bankOf('hat')}.dec(tri.fast(4).range(0.05, 0.12)).gain(${g(hatGain * mut.hats)})${percEnter}.pan(sine.slow(4))` + (swing > 0 ? `.swingBy(${r2(swing)}, 4)` : '')
      out.push(orbit(hats + dropDuck + exitDuck, ORBIT.perc))
      const snPly = role === 'break' ? 0 : peak ? 0.28 : 0.14
      const snarePat = role === 'break' ? '~ sd ~ sd' : dr.snare
      const drumSat = r2(Math.min(0.16, mood.fx.saturation * 0.16 + (dc.drumShape ?? 0)))
      out.push(orbit(`s("${snarePat}")${bankOf('snare')}.sometimesBy(${snPly}, x => x.ply(2)).gain(${g(MIX.snare * (role === 'break' ? 0.5 : 1))})${percEnter}${fxFor(0, 0.35)}.shape(${drumSat}).lpf(7500)${dropDuck}${exitDuck}`, ORBIT.snare))
      if (dr.ghost && role !== 'break') out.push(orbit(`s("${dr.ghost}")${bankOf('snare')}.gain(${g(MIX.snare * 0.32)})${percEnter}.shape(0.1).lpf(6000)${dropDuck}${exitDuck}`, ORBIT.snare))
      if (dr.rim && role !== 'break') out.push(orbit(`s("${dr.rim}")${bankOf('snare')}.gain(${g(MIX.snare * 0.6)})${percEnter}.hpf(800).room(0.35).roomsize(8).delay(0.3).delaytime(${style.fx.delayTime}).delayfeedback(0.5)${dropDuck}${exitDuck}`, ORBIT.perc))
      if (peak && !(dr.snare === dr.clap)) {
        out.push(orbit(`s("${dr.clap}")${bankOf('clap')}.gain(${g(MIX.clap)})${percEnter}${fxFor(0, 0.3)}.shape(0.08).lpf(7500)${dropDuck}`, ORBIT.snare))
      }
```
(destructure: add `mood` if not present; `dropDuck/exitDuck/percEnter/peak/fxFor/g/mut/role/style` already are.)
- [ ] **Step 2:** delete `SectionContext.drumKit` field (L97), the `const drumKit = style.drumArchetype !== 'existing' ? DRUM_KITS[...] : null` (L372) and its inclusion in ctx (L376), the `DRUM_KITS` const (~L817), and the `DrumKit`/`DrumArchetype` imports/usages that are now dead. Keep `DrumArchetype`/`DRUM_KITS`/`DrumKit` in `trackStyle.ts` only if still referenced (the legacy `drumArchetype` field references the type — keep the TYPE, the `DRUM_KITS` map moves out).
- [ ] **Step 3:** `npx tsc -b --noEmit` — PASS (resolve any dead-ref).
- [ ] **Step 4:** `npx vitest run --config vitest.config.ts tests/unit/radioRenderSanity.test.ts` — PASS (programs structurally valid).
- [ ] **Step 5: Commit** `feat(radio): renderPerc reads drum rhythm/kit/colour; drop DRUM_KITS (note 8 stage 2)`

---

### Task 7: Audition, snapshot re-baseline, no-cascade verify, full suite

**Files:** Modify `tests/unit/__snapshots__/radioSnapshot.test.ts.snap`.

- [ ] **Step 1 (BY-EAR GATE):** render several tracks' kick + kit lines, present pasteable strudel.cc snippets (kick colour over a few banks/grooves). Get explicit USER approval. DO NOT re-baseline without it.
- [ ] **Step 2:** re-baseline: `npx vitest run -u --config vitest.config.ts tests/unit/radioSnapshot.test.ts`.
- [ ] **Step 3 (no-cascade verify):** `git diff …radioSnapshot.test.ts.snap | grep -oE "\.orbit\([0-9]+\)" | sort | uniq -c` — expect ONLY `.orbit(2)` (kicks), `.orbit(3)` (perc), `.orbit(7)` (snare). If `.orbit(4/6/8/9)` (bass/lead/bg/arp) appear → the legacy drum picks were NOT preserved in `chooseStyle`; restore them so the main rng stream is byte-identical, then re-baseline.
- [ ] **Step 4:** `npm run test:unit` — all green.
- [ ] **Step 5: Commit** `test(radio): re-baseline snapshots for drum decomposition (note 8 stage 2)`

---

## Self-Review notes

- **Spec coverage:** рисунок (Task 1) × набор (Task 2) × цвет/note 4 (Task 3) × selection+mood-guard+no-cascade (Task 4) × render kick (Task 5) × render perc + cleanup (Task 6) × audition+re-baseline+verify (Task 7). All mapped.
- **No-cascade:** Task 4 keeps the legacy drum picks consuming `rng`; the real triple comes from `drumRng`. Task 7 Step 3 verifies (only orbits 2/3/7) and prescribes the fix.
- **erasableSyntaxOnly:** all interfaces/`type`; the `drum` union in `kitBankOf` is a string-literal param type, fine.
- **Type consistency:** `DrumRhythm/DrumKit/DrumColor` + `kitBankOf`/`kickColorChain` names used identically across Tasks 1-6.
- **Legacy fields:** kept in TrackStyle on purpose (rng-stream stability) — documented, not a leak.
