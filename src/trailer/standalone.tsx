/**
 * Точка входа ЗАМОРОЖЕННОГО трейлера (immutable-сборка, см. vite.trailer.config.ts → trailer-dist/).
 * Рендерит только TrailerScreen (внутри ForceLocale='en' + свой провайдер SFX), ни от чего в остальном
 * приложении не зависит. Жест «PLAY» нужен для разблокировки аудио (autoplay-политика браузера).
 * В главный бандл игры этот файл не входит — он достижим только из trailer.html (отдельная сборка).
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

// Один движок SFX на страницу (AudioContext создаётся, остаётся suspended до жеста).
const engine = new ThreeSfxEngine()

function Standalone() {
  // 0 — не запущен (экран PLAY); >0 — идёт прогон (значение = key для перезапуска).
  const [runId, setRunId] = useState(0)

  const start = useCallback(async () => {
    await engine.load().catch(() => { /* без SFX */ })   // буферы звуков; клик разблокирует аудио
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
