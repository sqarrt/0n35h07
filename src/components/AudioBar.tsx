import { useEffect, useRef } from 'react'
import { HUD_FRAME_INSET } from '../constants'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'

const COLOR = '#4af'
const LEVEL_GAIN = 3.2        // визуальное усиление (RMS звука мал) → полоса заметна
const SMOOTH_UP = 0.5         // быстрая атака
const SMOOTH_DOWN = 0.12      // плавный спад
const MAX_WIDTH_FRAC = 50     // макс. ширина контейнера, % экрана (как полоса возрождения)
const BAR_HEIGHT = 4
const BAR_BOTTOM_OFFSET = 14  // над нижней полосой возрождения (та на HUD_FRAME_INSET)

/**
 * Полоса-визуализатор громкости (музыка + эффекты матча). Растёт из центра по общему уровню звука;
 * лежит снизу HUD над полосой возрождения. Обновляется в rAF (вне React-рендера) со сглаживанием.
 */
export function AudioBar({ analysis }: { analysis: AudioAnalysis }) {
  const fillRef = useRef<HTMLDivElement>(null)
  const level = useRef(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const target = Math.min(1, analysis.level() * LEVEL_GAIN)
      level.current += (target - level.current) * (target > level.current ? SMOOTH_UP : SMOOTH_DOWN)
      const el = fillRef.current
      if (el) {
        el.style.width = `${level.current * 100}%`
        el.style.opacity = `${0.3 + 0.7 * level.current}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analysis])

  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: HUD_FRAME_INSET + BAR_BOTTOM_OFFSET,
      transform: 'translateX(-50%)', width: `${MAX_WIDTH_FRAC}%`, height: BAR_HEIGHT,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 14,
    }}>
      <div ref={fillRef} style={{ height: '100%', width: '0%', background: COLOR, boxShadow: `0 0 8px ${COLOR}` }} />
    </div>
  )
}
