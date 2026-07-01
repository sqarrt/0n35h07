# Note 8 Stage 2 — Drums decomposition (рисунок × набор × цвет) — Design

**Status:** approved 2026-07-01. Branch `feature/radio-notes` (off `release_1.0.0`).

**Goal:** Decompose the radio DRUMS into three independently-chosen axes — **рисунок** (groove pattern) ×
**набор** (which sample kit) × **цвет** (per-track processing) — mirroring the lead decomposition (stage 1).
Fixes **note 4** ("the kick sounds samey — the specific sound, not the rhythm") via the colour axis + the kit.

**Why:** The groove already varies (`DrumArchetype`), but the kick TIMBRE varies only by bank (`kickVoice`),
and the processing (shape/lpf/gain) is derived from mood/section, NOT per-track — so the kick reads samey.
Decoupling kit + colour as their own axes (and extending the bank to the whole kit) fixes the actual complaint.

---

## Current state

- `trackStyle.ts`: `chooseStyle` picks `kickVoice` (`{bank,n}` from `KICK_VOICES`, 9), `kickPat` (`KICK`), `clapPat`
  (`CLAP`), `hatPat` (`HAT`), `swing` (`SWING`), `drumArchetype` (`DRUM_ARCHETYPES`) — each via `pick(rng, …, anti, cat)`.
- `RadioComposer.ts`: `DRUM_KITS` (amen/industrial/broken/minimal groove kits) chosen by `style.drumArchetype`;
  `renderKick` builds the kick (`s(kickPat).bank(kv.bank).n(kv.n).shape(kickShape)…lpf`), `renderPerc` builds
  hat/snare/clap/ghost/rim. `kickShape`/`kickLpf` are functions of mood.density / section / archetype only.
- Engine loads `tidal-drum-machines.json` → all banks (RolandTR909/808/707/606/505/AkaiLinn…) provide bd/sd/hh/cp,
  so a single `.bank(X)` works for the WHOLE kit, not just the kick.

## Decisions (locked via brainstorming)

1. **Full 3-axis refactor** (not just note 4): рисунок × набор × цвет.
2. **Kit:** mostly coherent single-bank kits + a few curated hybrids (e.g. 808 kick + 909 hats).
3. **Colour:** noticeable but in-genre — each track's kick clearly differs (punch/click/boom/drive/decay) while
   staying dark-techno-appropriate.
4. Axes chosen **independently** per track (mood-guarded anti-repeat), stable across all sections (no per-movement
   re-roll). Reuse `engines/leadAxes.pickAxis` + `MoodTagged` (generic).

---

## Architecture — three axes

### Ось РИСУНОК — `engines/drumRhythm.ts`
Unifies `DRUM_KITS` + the per-element `KICK`/`HAT`/`CLAP` pools into one catalog of grooves.
```ts
export interface DrumRhythm extends MoodTagged {
  kick: string; hat: string; snare: string; clap: string
  ghost?: string; rim?: string; swing: number
}
export const DRUM_RHYTHMS: DrumRhythm[]   // amen / broken / industrial / minimal / four-floor variants (~8-10)
```

### Ось НАБОР — `engines/drumKit.ts`
Which bank/samples for the whole kit. Coherent (one bank everywhere) + a few hybrids.
```ts
export interface DrumKit extends MoodTagged {
  kickBank: string; kickN: number
  snareBank?: string; hatBank?: string; clapBank?: string   // default to kickBank when absent (coherent)
}
export const DRUM_KITS_SND: DrumKit[]   // 909 / 808 / 707 / 606 / 505 / Linn / dirt + ~2 hybrids (~8-10)
```
Rendered as `.bank(<bank>)` (+ `.n(kickN)` on the kick) per drum layer. An empty `bank` = the default dirt/EmuSP12
samples (the original sound), so the legacy character stays in the pool.

### Ось ЦВЕТ — `engines/drumColor.ts`
Per-track processing character (note 4). Noticeable, in-genre.
```ts
export interface DrumColor extends MoodTagged {
  kickShape: number          // saturation/drive base (0..0.6)
  kickDrive?: string         // optional .distort("a:b")
  kickDecay?: number         // .decay() — tight vs boomy
  kickLpf?: number           // base low-pass (dark boom ↔ bright click)
  kickClick?: boolean        // add a short bright transient layer for punch
  drumShape?: number         // saturation on snare/hat/clap
  room?: number              // light kit reverb send
}
export const DRUM_COLORS: DrumColor[]   // punchy / boomy-sub / crunchy-drive / tight-dry / lo-fi-crush / gated (~6-8)
```
The colour provides the kick's BASE character; mood/section still modulate AROUND it (energy envelope,
deep/muffled, peak), instead of fully defining it as today.

## Selection & integration

- `chooseStyle` picks `drumRhythm` (`drum_rhythm`), `drumKit` (`drum_kit`), `drumColor` (`drum_color`) via
  `pickAxis(catalog, moodId, drumRng, anti, cat)`. `TrackStyle` gains `drumRhythm: DrumRhythm; drumKit: DrumKit;
  drumColor: DrumColor`; the old `kickVoice/kickPat/clapPat/hatPat/swing/drumArchetype` fields are REMOVED (and
  `KICK_VOICES/KICK/CLAP/HAT/SWING/DRUM_ARCHETYPES/DRUM_KITS` migrate into the new catalogs).
- **No-cascade rule:** the three drum picks use a DEDICATED `drumRng = createRng(\`${seed}:drums\`)` (NOT the
  shared style rng), so replacing 6 old picks with 3 new ones does NOT shift the lead/bass/mood style choices made
  later in `chooseStyle`. Re-baseline must then touch ONLY drum orbits (2 kicks / 3 perc / 7 snare), not 4/6/8/9.
- `renderKick`: kick pattern from `drumRhythm.kick`; `.bank(drumKit.kickBank).n(drumKit.kickN)`; base
  shape/decay/lpf/drive/click from `drumColor`, then mood/section modulation (energyEnv, muffled→lpf, deep, peak)
  layered on. Fills/boundary/duck logic unchanged.
- `renderPerc`: hat/snare/clap/ghost/rim from `drumRhythm`; `.bank(drumKit.{hat,snare,clap}Bank ?? kickBank)`;
  swing = `drumRhythm.swing + mut.swing`; `drumColor.drumShape/room` on the non-kick layers.

## Testing

- **Unit (pure, node):** catalog id-uniqueness & validity (drumRhythm/drumKit/drumColor); `chooseStyle` picks the
  drum triple and respects the mood guard (a HARD-only kit/colour never appears under a calm mood); a render-level
  assert that the kick string carries the chosen bank + a colour marker. (`pickAxis` itself is already tested.)
- **Snapshot:** re-baseline `radioSnapshot` (drums change a lot — intended). VERIFY only orbits 2/3/7 change; if
  4/6/8/9 (bass/lead/bg/arp) shift → the drumRng isolation leaked; fix before committing. `radioRenderSanity` green.
- **By-ear:** audition kick colours + kits (strudel.cc snippets / in-app) and get USER approval BEFORE re-baselining.

## Out of scope

Stage 3 (bass decomposition); note 6 (references). The `RhythmEngine.buildDrums` per-step dynamics
(`drums.gain`) stays as-is (orthogonal to the three axes).
