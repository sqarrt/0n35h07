# Note 8 Stage 3 — Bass decomposition (рисунок × мелодия × цвет) — Design

**Status:** approved 2026-07-01. Branch `feature/radio-notes` (off `release_1.0.0`).

**Goal:** Decompose the radio BASS into three independently-chosen axes — **рисунок** (rhythm mask + accents) ×
**мелодия** (semitone-offset contour) × **цвет** (synth source + fx + filter) — so combinations yield far more
unique basslines. The bass is the most entangled part; the 303-acid path stays bespoke.

**Why:** Today each `bassArchetype` (`BASS_VOICES`) fuses rhythm (`_`/`~` in `off`), melody (the offsets) and
even positional accents (`.gain("…")`) into one voice, and the 303 acid is a separate engine — so variety is
capped at the catalog. Decoupling the axes (mirroring lead/drums) multiplies the combinations.

---

## Current state

- `RadioComposer.renderBass`: `style.bassArchetype === 'existing'` → `BassEngine.buildBass` (the 303 acid:
  root-pulse + acidenv squelch + `style.bassGroove` mask + `style.bassSound`/`bassFm`/`bassRest` + saturation).
  Otherwise → `BASS_VOICES[archetype]` = `{ off, src, fx, shove?, drift?, filt? }`, transposed via
  `.add(note("<roots>"))`, with `disguiseCells` reordering (SKIPPED for voices carrying positional `.gain("…")`).
- `off` are SEMITONE offsets (`0` root, `6` tritone, `7` fifth); `.add(note("<roots>"))` supplies the per-bar root.
- `trackStyle.chooseStyle` picks `bassSound/bassFm/bassRest` (`st_bass`), `bassGroove` (`st_bgroove`),
  `bassArchetype` (`st_bassarch`).
- Extra layers in renderBass (KEEP): the entry filter-sweep (`bassLpf`), the constant sub-sine (ORBIT.fx, on the
  roots), shadow B (fifth-up superimpose), shadow A (`buildCounter` ghost bass), the exposed-section boost.

## Decisions (locked via brainstorming)

1. **303 acid = a bespoke цвет.** An `acid` colour runs `BassEngine` with its own root-pulse melody/rhythm; the
   rhythm/melody axes apply only to NON-acid colours (like the lead's `atmoDyad` bespoke path). Low risk.
2. **Positional accents → the рисунок axis.** A рисунок = an onset mask + an optional 16-step accent (velocity)
   pattern. Decouples accents from a specific melody (removes the disguise-skip special case).
3. Axes chosen **independently** per track (mood-guarded anti-repeat), stable across sections. Reuse `pickAxis`.

---

## Architecture — three axes

### Ось РИСУНОК — `engines/bassRhythm.ts`
```ts
export interface BassRhythm extends MoodTagged { mask: string; accent?: string }
// mask: 16 tokens — 'x' onset, '_' sustain, '~' rest (BASS LAW: never all-rest). accent: 16 gains e.g. '1 0.5 0.7 0.5 …'
export const BASS_RHYTHMS: BassRhythm[]   // root-pulse / syncopated / walking-8ths / sparse-dub / gallop (~8)
```
Migrated from the `off` rest-structure of `BASS_VOICES` + the `BASS_GROOVE` pool + the accent `.gain` patterns.

### Ось МЕЛОДИЯ — `engines/bassMelody.ts`
```ts
export interface BassMelody extends MoodTagged { offs: number[]; drift?: boolean; shove?: string }
// offs: SEMITONE offsets consumed at each onset (looped). drift: a slow downward pitch slide (chromaDescent).
// shove: an optional per-bar transpose, e.g. '.add(note("<0 0 6 0>"))' (pulseHorror).
export const BASS_MELODIES: BassMelody[]   // rootHold / tritoneStab / fifthWalk / chromaDescent / minorWalk + gen walk (~8)
export function bassWalk(rng: Rng, n: number): number[]   // a small generative offset walk (root-anchored, dark)
```

### Ось ЦВЕТ — `engines/bassColor.ts`
```ts
export interface BassColor extends MoodTagged {
  src?: string; fx?: string; filt?: (n: number, lateAlign: string) => string; acid?: boolean
}
export const BASS_COLORS: BassColor[]   // acid(bespoke) / supersawDrive / bitcrush / wobble / wavetableFlute / wtDigital / cleanSub (~8)
```
Migrated from `BASS_VOICES.src/fx/filt` + `bassSound`/`bassFm`. `acid:true` = the bespoke `BassEngine` path.

## Selection, combination & integration

- `chooseStyle(rng, anti, moodId, bassRng)` picks `bassRhythm` (`bass_rhythm`), `bassMelody` (`bass_melody`),
  `bassColor` (`bass_color`) via `pickAxis` from a DEDICATED `bassRng = createRng(\`${seed}:bass\`)`. The 3 legacy
  bass picks (`st_bass`/`st_bgroove`/`st_bassarch`) STAY (rng-stream reserve — removing them re-cascades; unused by
  the renderer). `TrackStyle` gains `bassRhythm/bassMelody/bassColor`. `CompositionScheduler.buildTrack` passes
  `mood` + `bassRng` (alongside the stage-2 `drumRng`).
- **Combiner** `combineBass(rhythm: BassRhythm, offs: number[]): string` → the 16-step offset string: walk `mask`,
  on `x` take the next offset (looped), on `_` emit `_`, on `~` emit `~`.
- `renderBass`:
  - `if (style.bassColor.acid)` → the existing `BassEngine.buildBass` path UNCHANGED (acidenv, groove from a
    root-pulse rhythm, saturation, fm, fat/wide).
  - else → `note("<combined>")` + (`.gain("<accent>")` if `rhythm.accent`) + `.add(note("<roots>"))` +
    `melody.shove ?? ''` + (drift: `.add(note(saw.range(0,-12).slow(n)…))`) + `color.src` + `color.fx` +
    `.clip(0.95)` + `(color.filt?.(n, lateAlign) ?? .lpf(bassLpf))` + `bassSuper`.
  - The sub-sine, shadows (A/B), entry sweep, boost, ducks — UNCHANGED.
- **No-cascade:** the `bassRng` isolation means the re-baseline touches ONLY orbit 4 (bass main + shadow). The
  sub-sine (orbit 8) is built from the roots → unchanged.

## Testing

- **Unit (pure, node):** catalog id-uniqueness/validity (bassRhythm/bassMelody/bassColor); `combineBass`
  (onset→offset, `_`→sustain, `~`→rest, offset loop, exactly 16 tokens); `chooseStyle` picks the bass triple and
  respects the mood guard (a HARD-only colour never under a calm mood); at least one `acid:true` colour exists.
- **Snapshot:** re-baseline `radioSnapshot` (bass changes — intended). VERIFY only orbit 4 changes; if 2/3/6/7/8/9
  shift → the bassRng isolation leaked; fix before committing. `radioRenderSanity` green.
- **By-ear:** audition basslines (strudel.cc snippets / in-app) and get USER approval BEFORE re-baselining.

## Out of scope

Note 6 (references). `BassEngine` internals are unchanged (the acid colour reuses it). `buildCounter` (shadow A)
and the sub-sine are unchanged.
