# 0N35H07 trailer — how it works and how to edit it

A map of the trailer: makes it easy to ask an assistant ("tweak the trailer: …") and to find the right spot.

## What it is and where it runs

The trailer is a **replay of real bot matches** (recorded beforehand) plus transitions, text and music. It plays
back through the same game classes as a match (Player/Body/BeamWeapon/FX/HUD/map) → it looks "in-game". The
combat is not simulated: recorded frames and events are played back.

Launch in-game: **Settings → "About" → WATCH** → `screen === 'trailer'` in `src/App.tsx` renders
`<TrailerScreen>`. Clicking WATCH is the gesture that unlocks audio.

The trailer HUD is forced to **English** — via `<ForceLocale id="en">` in `TrailerScreen.tsx`
(see `src/i18n/index.ts`), regardless of the settings language.

## Two copies of the trailer

1. **Live** (plays from settings): rendered by the current game code. Isolated from game LOGIC (it replays
   snapshots, doesn't compute combat), but depends on RENDER code (player/FX/map/audio/HUD classes). As long as
   you don't touch the trailer files and those classes, you won't break it.
2. **Frozen** (`trailer-dist/`, committed to the repo): a standalone build that depends on nothing in the
   project — game edits don't break it. Rebuilt **automatically by `npm run build`** (as the last step), or
   separately via `npm run build:trailer`. After building, commit `trailer-dist/`. Preview: `npx serve trailer-dist`.
   The build code itself (`vite.trailer.config.ts`) is not included in the artifact.

## Files

| File | Purpose |
|---|---|
| `trailerEdl.ts` | **Storyboard (EDL).** The main place to edit: shot order, demo slices, interstitial text. |
| `TrailerSequencer.tsx` | Orchestrator: shots in order, music, countdown, text, HUD, finale, volumes. |
| `DemoScene.tsx` | Plays demo fragments with the real classes (camera, players, FX, sounds). |
| `FinaleScene.tsx` | Finale: a slow-motion head-on shot from the side with the camera pulling back. |
| `TrailerScreen.tsx` | Wrapper: `ForceLocale=en` + sequencer. |
| `../../game/audio/TrailerMusic.ts` | Deterministic music (fixed progression). |
| `../../ui/theme.css` | Styles for interstitials (`.trailer-cut`), title, cover (`.trailer-cover`), the PLAY screen (`.trailer-gate`). |
| `../../../public/demos/*.demo.json` | Recorded matches (source material for slicing). |
| `../../trailer/standalone.tsx`, `vite.trailer.config.ts`, `trailer.html` | The frozen build (see above). |

## Common edits

### Slicing: order, fragments, duration — `trailerEdl.ts`
`TRAILER_SHOTS` — shots in order. Types: `countdown` (countdown over emptiness), `text` (interstitial), `play`
(clip + `ranges: [{from,to}]`, indices = FRAME NUMBERS), `finale`.
- **30 fps**: 1.5 s ≈ 45 frames. Keep a fragment ≤ ~1.5 s (`to - from ≤ ~45`).
- Several fragments of the same clip in one `play` — jump cuts (no rebuild → no flicker).
- **Switching clips = a new `play` shot**: the rebuild is hidden by the cover (`.trailer-cover`), with a `text` between clips.
- Show at least one fragment of each skin (clip) in third person (TP).
- `CUT_MS` — interstitial duration.

### Volumes and audio timing — `TrailerSequencer.tsx`
- `TRAILER_SFX_GAIN` (0.45) — game sounds; `COUNTDOWN_SFX_GAIN` (1.0) — the countdown and "go" on interstitials.
- Music starts on "go" (end of countdown), no fade-in. Echo at the end — `music.stop()` when the beams freeze; the
  tail margin is `ECHO_TAIL_MS`.
- "go" on interstitials plays slightly before the text (to land on the animation beat): the lead is `NEAR_END_LEAD_MS`
  in `DemoScene.tsx` (less = later). The first interstitial has no "go".

### Sounds in the demo scene — `DemoScene.tsx`
The fire sound = the whole shot, from the START of the windup, variant by style (`BEAM_SFX`). At seams — `seedFlags`
(so an ongoing windup doesn't "re-fire"). Gotcha: if a fragment cuts off at the start of a windup, the long sound
"leaks" into the next fragment → pick the `to` boundary carefully (end before a new windup).

### Finale — `FinaleScene.tsx`
Fighters `A`/`B`: `color`/`ring`/`model`/`windup`/`x`. Camera: `CAM_Z0→CAM_Z1`, `CAM_DUR`. Slow-motion:
`CHARGE_DUR`/`SLOWMO_CHARGE`/`SLOWMO_HOLD`; `BEAM_REACH` — how far the beams travel. `FINALE_DUR` — the end.

### Music — `../../game/audio/TrailerMusic.ts`
Progression by loops: `0` kicks+bass → `1` +lead1 → `2`+ +lead2. Volumes — `KICK_GAIN`/`BASS_GAIN`/`LEAD_GAIN`.

## Demos

`public/demos/*.demo.json` — frame-independent snapshots (camera + both players + score/timer/streaks/phase +
events), so any sub-range replays correctly. Type — `../../game/demo/demoTypes.ts`.

### Recording a new demo (dev ONLY)
1. `npm run dev`, start a bot match.
2. **F9** — start, **F9** again — stop (downloads a `.demo.json`).
3. File → `public/demos/`, name → into `CLIP_FILES` (`trailerEdl.ts`).

Recording (`../../game/demo/DemoRecorder.ts` + the `match.recorder` hook) is enabled only in dev and is **stripped
from the production build** (DCE on `import.meta.env.DEV` + dynamic import in `Game.tsx`).

### Finding moments to slice (dev scripts)
- `node scripts/analyzeDemo.mjs public/demos/<file>` — kills/streaks/CATALYST/perfect blocks (timecode, frame, FP/TP).
- `node scripts/analyzeDodges.mjs public/demos/<file>` — where the OPPONENT dodges the player's shot.
- `node scripts/inspectFrames.mjs public/demos/<file> <from> <to>` — raw windup/events over a frame range.

## How to ask for edits

Examples: "drop the triple-kill fragment on pillars", "make interstitials 0.2 s longer", "add one more opponent
dodge before the finale", "spread the players further apart in the finale", "second interstitial text → …". The
assistant will find the moment via the `analyze*` scripts and edit `trailerEdl.ts` / the right file. The frozen
copy rebuilds itself on `npm run build` (or manually via `npm run build:trailer`) — after that, commit `trailer-dist/`.
