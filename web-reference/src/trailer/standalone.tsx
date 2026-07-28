/**
 * Entry point of the FROZEN trailer (immutable build, see vite.trailer.config.ts → trailer-dist/).
 * Renders only TrailerScreen (with ForceLocale='en' + its own SFX provider) and depends on nothing else
 * in the app. The "PLAY" gesture is needed to unlock audio (browser autoplay policy).
 * This file is not part of the main game bundle — it is reachable only from trailer.html (separate build).
 */
import { createRoot } from 'react-dom/client'
import { useState, useCallback } from 'react'
// @ts-expect-error fontsource is CSS-only package
import '@fontsource/share-tech-mono'
import '../index.css'
import '../ui/theme.css'
import { ThreeSfxEngine } from '../game/audio/sfx/ThreeSfxEngine'
import { SfxProvider } from '../sfx/SfxContext'
import { TrailerScreen } from '../components/trailer/TrailerScreen'

// One SFX engine per page (AudioContext is created, stays suspended until a gesture).
const engine = new ThreeSfxEngine()

// Entry point (render bootstrap), not a hot-reloaded component module → the fast-refresh rule does not apply.
// eslint-disable-next-line react-refresh/only-export-components
function Standalone() {
  // 0 — not started (PLAY screen); >0 — running (value = key for restart).
  const [runId, setRunId] = useState(0)

  const start = useCallback(async () => {
    await engine.load().catch(() => { /* no SFX */ })   // sound buffers; the click unlocks audio
    setRunId(id => id + 1)
  }, [])

  if (runId === 0) {
    return (
      <div className="trailer-gate">
        <button className="trailer-gate__btn" onClick={start}>▶ PLAY TRAILER</button>
      </div>
    )
  }
  return (
    <SfxProvider engine={engine}>
      <TrailerScreen key={runId} masterVolume={1} onDone={() => setRunId(0)} />
    </SfxProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Standalone />)
