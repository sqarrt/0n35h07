# Radio Mode Design

**Date:** 2026-06-25
**Branch:** to be cut from `release_0.5.11`

## Overview

An opt-in generative electronic music mode ("Radio") that replaces the existing stem-based menu and match music when enabled. Powered by the `RadioComposer` engine from `oneshot_music_editor`, which runs `@strudel/web` live-coding synthesis in-browser. When radio is off, the existing `MenuMusic` + `MatchMusic` system plays as today.

---

## 1. Files to Copy from `oneshot_music_editor`

Copy the following, preserving relative import paths, into `src/radio/`:

```
src/radio/
  index.ts                        ← renamed from src/radio-engine.ts (barrel, re-export all)
  music/
    radio/                        ← src/music/radio/** (pure composition core)
      AntiRepeatBuffer.ts
      CompositionScheduler.ts
      MoodScheduler.ts
      MusicalState.ts
      RadioComposer.ts
      arrangement.ts
      banks.ts
      engines/
      fx.ts
      radioConfig.ts
      theory.ts
      trackStyle.ts
      weighted.ts
    seededRandom.ts               ← src/music/seededRandom.ts
    StrudelWebEngine.ts           ← src/music/StrudelWebEngine.ts
    prelude.ts                    ← src/music/prelude.ts
    IStrudelEngine.ts             ← src/music/IStrudelEngine.ts
    stemContract.ts               ← src/music/stemContract.ts
    wavEncoder.ts                 ← src/music/wavEncoder.ts
    strudel-web.d.ts              ← src/music/strudel-web.d.ts
  app/
    RadioController.ts            ← src/app/radio/RadioController.ts
    radioBanks.ts                 ← src/app/radio/radioBanks.ts
  trackName.ts                    ← NEW (see §3)
```

JSON banks (5 files) go into `public/radio/`:

```
public/radio/
  moods.json
  progressions.json
  drums.json
  instruments.json
  scales.json
```

Do NOT copy: authoring UI, `MusicDirector`, `gameSfx`, `sfxClient`, `libraryClient`, `vite-plugin-fileops`, WAV-export UI.

### npm dependency

```
npm i @strudel/web
```

`@strudel/web` is AGPL — compatible with the game's AGPL-3.0 license.

### Tauri CSP

The `StrudelWebEngine` loads drum-machine samples from external CDN URLs (GitHub raw, `strudel.b-cdn.net`). The Tauri `tauri.conf.json` CSP must allow these origins:

```json
"connect-src": "https://raw.githubusercontent.com https://strudel.b-cdn.net"
```

Synth voices (saw/supersaw/sine/pulse/white) need no samples and play immediately. CDN samples load in the background after `initStrudel()` — the engine never blocks on a failed sample load.

---

## 2. Track Name Generation

**File:** `src/radio/trackName.ts`

```ts
// MusicalState → "dark_techno_124bpm_a3f9"
export function radioTrackName(state: MusicalState): string {
  const suffix = djb2hex(state.trackSeed)   // 4-char lowercase hex
  return `${state.mood}_${state.bpm}bpm_${suffix}`
}

function djb2hex(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(16).slice(-4)
}
```

Examples: `dark_techno_124bpm_3f2a`, `dub_techno_118bpm_8c41`, `acid_dark_132bpm_07b9`.

Same naming spirit as model names (`RTX4080`, `AX12S`) — hardware-index style, no localisation.

---

## 3. App-level Architecture

### State added to `App`

```ts
// Lazy-created on first warmup. null = not yet initialised.
const [radioController, setRadioController] = useState<RadioController | null>(null)
// 'idle' | 'loading' | 'ready' | 'error'
const [radioInitState, setRadioInitState] = useState<RadioInitState>('idle')
const [radioMusicalState, setRadioMusicalState] = useState<MusicalState | null>(null)
```

`radioEnabled: boolean` and `volumeRadio: number` are added to `PlayerProfile` (persisted in localStorage via `settings.ts`). Default: `radioEnabled: false`, `volumeRadio: 0.8`.

### Warmup

Triggered when the `RadioMiniPlayer` mounts (visible in all menu screens). Runs once:

```
lazy import('./radio/index')
  → loadRadioBanks(fetch, '/radio/')
  → new StrudelWebEngine()
  → initStrudel()   (registers AudioWorklets, starts CDN sample prefetch in bg)
  → setRadioInitState('ready')
```

On error: `setRadioInitState('error')`. The controller is stored in a ref during init; only committed to state once ready.

### Music switching

```ts
// radioEnabled = true
menuMusic.stop()
radioController.setVolume(profile.volumeMaster * profile.volumeRadio)
radioController.start()   // must be from a user gesture — the toggle button IS the gesture

// radioEnabled = false
radioController.stop()
menuMusic.start()
```

During the match (`screen === 'game'`): radio keeps playing uninterrupted. `Game` receives `radioActive: boolean`; when true it skips `MatchMusic.start()` and `MatchMusic.fadeOut()`.

Volume wiring: `profile.volumeMaster * profile.volumeRadio` → `radioController.setVolume(...)`. Live updates (slider drag) push directly to the controller, no re-render of Canvas.

### New `Screen` value

```ts
type Screen = 'menu' | 'lobby' | 'game' | 'settings' | 'appearance' | 'about' | 'trailer' | 'radio'
```

---

## 4. UI Components

### 4a. `RadioMiniPlayer` — persistent corner widget

Rendered in all non-game, non-trailer, non-radio screens (bottom-right corner, above `VersionChip`). Hidden on the Radio screen itself — the full screen renders the same information expanded.

States:
| `radioInitState` | `radioEnabled` | Display |
|---|---|---|
| `idle` / `loading` | — | `RADIO ···` (dimmed, not clickable) |
| `error` | — | `RADIO ✕` (dimmed) |
| `ready` | `false` | `RADIO` button (enabled) |
| `ready` | `true` | `■ RADIO` + track name on the right, clickable → opens `'radio'` screen |

When enabled, clicking the track name navigates to the Radio screen. The toggle button itself switches `radioEnabled`.

**Visual style — Apple Glass:**
```css
background: rgba(10, 15, 20, 0.55);
backdrop-filter: blur(24px) saturate(160%);
border: 1px solid rgba(255, 255, 255, 0.12);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.18),   /* top specular highlight */
  0 8px 40px rgba(0, 0, 0, 0.5),
  0 0 0 0.5px rgba(255, 255, 255, 0.06);
border-radius: 14px;
```

Font: `var(--ui-font)` (Share Tech Mono), accent colour `var(--accent)` for the active state.

### 4b. `Radio` screen — full-screen player

Accessible via RADIO button in `MainMenu` (new secondary button, same width as others) and via track-name click in the mini-player.

Layout (centred column, glass card):
```
┌─────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← glass card, 480px max-width
│                                 │
│   RADIO                         │  ← section label (small caps, --accent)
│                                 │
│   dark_techno_124bpm_3f2a       │  ← track name (large, monospace)
│                                 │
│   124 BPM  ·  E phrygian        │  ← secondary info row
│   section: drop  ·  bar 32      │
│                                 │
│          [ ▶ START ]            │  ← play/stop button (primary)
│                                 │
│   ─────────────────  0.8  ───   │  ← volume slider (0..1)
│                                 │
│            [ ← BACK ]          │
└─────────────────────────────────┘
```

Disabled / loading state: play button shows `···` and is non-interactive; a one-line status text beneath ("initializing…" / "error — check connection").

The glass card uses the same CSS as the mini-player. Backdrop: the `MenuBackdrop` 3D scene plays behind the glass (same as other screens).

**No Strudel code panel** in the game's Radio screen (that's the editor's concern).

### 4c. `MainMenu` changes

One new secondary button added below `About`:

```tsx
<Button variant="secondary" style={btn} onClick={onRadio}>RADIO</Button>
```

Button width unchanged (`50%`) — no layout shift on other buttons. Standard game button style, no glass treatment — glass is only for the mini-player and the Radio screen card.

---

## 5. Settings integration

New entry in Settings → Sound section:

```
Radio volume   [──────●──] 0.8
```

`volumeRadio` in `PlayerProfile`, same pattern as `volumeMenuMusic` / `volumeMusic`. Slider only visible (or enabled) when radio module has initialised, otherwise greyed out.

---

## 6. Lazy loading

`@strudel/web` and the entire `src/radio/` subtree are imported via dynamic `import()` at warmup time, so the chunk is excluded from the initial bundle. Vite splits it automatically.

---

## 7. Affected files

| File | Change |
|---|---|
| `src/radio/**` | New — copied + `trackName.ts` added |
| `public/radio/*.json` | New — 5 bank files |
| `src/settings.ts` | Add `radioEnabled`, `volumeRadio` to `PlayerProfile` |
| `src/App.tsx` | Radio lifecycle, new screen, mini-player rendering |
| `src/screens/MainMenu.tsx` | Add RADIO button |
| `src/screens/Radio.tsx` | New screen component |
| `src/components/RadioMiniPlayer.tsx` | New component |
| `src/Game.tsx` | Accept `radioActive: boolean`, skip MatchMusic when true |
| `src-tauri/tauri.conf.json` | CSP: allow CDN origins for Strudel samples |
| `package.json` | Add `@strudel/web` |

---

## 8. Testing

- **Unit:** `radioTrackName()` — snapshot tests for known `MusicalState` inputs.
- **Unit:** Radio init state machine — mock `loadRadioBanks` / `initStrudel` to simulate loading / error.
- **E2E:** Not required for this feature (Strudel's AudioContext doesn't run in jsdom / Playwright headless without audio context). The toggle and screen navigation can be tested via debug globals if needed.

No changes to existing music tests.
