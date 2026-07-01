# Note 8 — Lead decomposition (рисунок × мелодия × цвет) — Design

**Status:** approved 2026-07-01. Branch `feature/radio-notes` (off `release_1.0.0`).

**Goal:** Split the radio LEAD archetype into three interchangeable axes — **рисунок** (rhythm / when it
plays) × **мелодия** (which notes) × **цвет** (which fx/timbre) — so independent combination yields far more
unique lead parts than the current ~20 fixed archetypes. Folds in **note 3** (the stale "ту-ту-ту-ту-ту-ру"
fill). This is stage 1 of note 8 (order: **lead → drums → bass**).

**Why:** Today one `LeadVoiceId` fuses pattern (rhythm+notes) and colour, so variety is limited to the
authored catalog. Decoupling the axes is the right way to get variety (vs the shelved E1 reject-sampling).

---

## Current state (what exists)

- `engines/MelodyEngine.ts` — `buildLead(chord, opts, state)` picks ONE archetype (`LeadVoiceId`, anti-repeat
  cat `lead_arch`) and renders its note CONTENT via `patternFor`. Returns `{ fragment: 'note("…")', voice,
  state }`. Rhythm + notes are FUSED in the `PHRASES` (4-bar `El[][]`) / `LINES` (16-step `El[]`) tables;
  `genWalk`/`genWeave` are procedural. `transformPhrase`/`transformLine` disguise (rotate/recombine) per track.
- `RadioComposer.renderLead` — wraps `fragment` with leadDev / `mut.leadFx` / the per-voice `LEAD_VOICES[voice]`
  synth+fx chain / entry filter-sweep / pan / gain. **The colour axis already exists** as `LEAD_VOICES` (in the
  composer) selected by the same archetype id.
- Note 3: `renderExitFill` melodic branch (~L727) hardcodes `[rt rt rt+7 rt rt+10 rt+7 rt+3 rt]`; the `subDrop`
  postKind (~L598) hardcodes `[48 42 36 30 24]`.

## Decisions (locked via brainstorming)

1. **Voicing → melody axis.** Melody = "which notes", a contour of scale degrees where each step may be a single
   note OR a stack (dyad/triad/octave). Multi-voice (atmoDyad/chordStab/doubleStop) lives in the melody axis.
2. **Melody = hybrid (approach C).** A catalog of authored contours (degree sequences stripped of rhythm) PLUS
   generative strategies (random-walk, chord arpeggio up/down, pedal+neighbour, descending cadence).
3. **Soft mood-guard.** Per-axis filter, not a joint cross-axis constraint.
4. Axes chosen **independently**, each with its own anti-repeat; stable per movement, varied per track.

---

## Architecture — three axes

### Ось РИСУНОК — `engines/leadRhythm.ts`
A catalog of onset masks over a 4-bar phrase (the lead's natural unit) — where the lead speaks vs breathes.

```ts
export interface LeadRhythm {
  id: string
  // 4 bars × 8 eighth-slots; a slot is an onset ('x'), a rest ('~'), or a 16th sub-pair ('xx').
  bars: string[]          // e.g. ['x ~ ~ x ~ ~ x ~', '~ ~ x ~ ~ ~ ~ ~', …] (length 4)
  gate?: number           // note length 0..1 (staccato→legato); default 0.5
  moods?: string[]        // soft guard — allowlist; absent = any mood
}
export const LEAD_RHYTHMS: LeadRhythm[]   // ~8–10: sparse / mid / dense-16th / syncopated / gallop / call-rest / …
```
Seeded onset/rest masks extracted from the existing `PHRASES`/`LINES` (rhythm only) + new ones. Only the EXTREME
masks carry `moods` (e.g. a gallop excludes calm/ambient moods).

### Ось МЕЛОДИЯ — `engines/leadMelody.ts`
Emits an ordered stream of degrees-or-stacks consumed at each rhythm onset.

```ts
export type MelEl = number | number[]              // a scale degree, or a stack of degrees (voicing)
export interface LeadMelody {
  id: string
  kind: 'contour' | 'strategy'
  voicing: 'mono' | 'dyad' | 'triad' | 'octave'    // how each step is stacked (which notes)
  contour?: MelEl[]                                 // kind:'contour' — looped/truncated to the onset count
  gen?: (rng: Rng, n: number) => MelEl[]            // kind:'strategy' — emit n degrees on demand
  moods?: string[]                                  // soft guard
}
export const LEAD_MELODIES: LeadMelody[]   // ~8 authored contours (from PHRASES/LINES degrees) + ~4 strategies
// strategies: walkDown (genWalk port), arpChord (up/down over chord tones), pedalNeighbour, descCadence
```

### Ось ЦВЕТ — `LEAD_COLORS` in `MelodyEngine` (selection) + `LEAD_VOICES` in composer (render)
The colour CATALOG (ids + mood tags) moves to the engine for independent selection; the fx CHAINS stay in the
composer (engine = selection, composer = rendering — no behaviour change downstream).

```ts
export interface LeadColor { voice: LeadVoiceId; moods?: string[] }
export const LEAD_COLORS: LeadColor[]   // the existing live LeadVoiceId set + soft mood tags on the extreme ones
```

---

## Combination & selection

**buildLead** (rewritten):
1. Pick `rhythm` (cat `lead_rhythm`), `melody` (cat `lead_melody`), `color` (cat `lead_color`) — each =
   mood-filter the catalog → weighted anti-repeat pick among survivors. **If <2 survivors → use the full
   catalog** (never empty).
2. **Combine** rhythm × melody → a `<[bar][bar][bar][bar]>` note string at DEGREE level mapped to absolute MIDI
   via the active `deg`:
   - walk the 4×8 slots; on an ONSET pull the next `MelEl` (loop the contour / `gen(rng, onsetCount)`); on a
     REST emit `~`; a 16th sub-pair places two consecutive elements.
   - a stacked `MelEl` renders `[a,b,…]`; `gate` → `_` sustains (legato) or short notes (staccato).
   - no length mismatch: contours loop, strategies emit exactly the onset count.
3. Light disguise retained: rotate the contour start per track (`seqDisguise.rotate`) for extra micro-variation.
4. Return `{ fragment: 'note("…")', voice: color.voice, state }`. `renderLead` downstream is UNCHANGED.

**State / stability:** the (rhythm, melody, color) triple is resolved once per movement (existing
`LeadState.motif` + `phrasesLeft`/REPHRASE) and kept across the movement's sections; a new triple after the
break (2nd movement). `LeadOpts` gains `mood: string` (the track mood id) for the guard. `buildBreakLead` keeps
the restful subset (filter melodies/colours flagged calm).

**No-cascade rule:** keep the number of `opts.rng` draws in `buildLead` stable (or use dedicated sub-seeds
`createRng(track.seed:lead…)` for the new picks) so re-baselining touches ONLY lead-orbit snapshot lines, not
bass/drums (verified the same way the bg cull was).

## Note 3 — fold-in

- **exit-fill melodic** (`renderExitFill`): replace the hardcoded run with a short `descCadence` melody-strategy
  contour, key-transposed, rendered on the same bass voice, seeded per exit (`createRng(track.seed:xfill…)`).
- **subDrop** (`postKind`): replace `[48 42 36 30 24]` with a seeded descending-sub generator (varied
  intervals/length/start), still a dark sine drop.

## Testing

- **Unit (pure, node):** combiner (onset/rest placement, contour loop & truncation, stack voicing, gate sustains);
  mood-guard (excludes tagged variants, falls back when <2, never empty); 3-axis anti-repeat (consecutive tracks
  differ on each axis); generative strategies (in-scale, downward bias, never a silent bar).
- **Snapshot:** re-baseline `radioSnapshot` (leads change for all seeds — deliberate). VERIFY only lead-orbit
  lines change (no cascade) before committing. `radioRenderSanity` stays green.
- **By-ear:** audition the new leads (strudel.cc snippets / in-app) and get user approval BEFORE re-baselining,
  exactly as the foley sounds were signed off.

## Out of scope (later stages)

Drums decomposition (stage 2, incl. note 4 kick colour); bass decomposition (stage 3); note 6 references (after
note 8). The colour fx chains themselves are not redesigned here — only decoupled from pattern selection.
