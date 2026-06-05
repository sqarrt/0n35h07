import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

// Угол: ниже угловой скобки щита (90px скобка + отступ от кромки) — не перекрывает её и не «прыгает».
const TOP = 116
const LEFT = 22
const FPS_WINDOW_MS = 500   // окно усреднения FPS

const wrap: CSSProperties = {
  position: 'fixed', top: TOP, left: LEFT, zIndex: 12, pointerEvents: 'none',
  fontFamily: 'var(--ui-font)', fontSize: 13, lineHeight: 1.5, letterSpacing: '0.08em',
  color: 'var(--accent)', textShadow: '0 0 6px rgba(0,0,0,0.85)',
}

interface StatsOverlayProps { showFps: boolean; showSpeed: boolean; speed: number }

/** Оверлей отладки: счётчик кадров (FPS) и текущая скорость игрока — по настройкам профиля. */
export function StatsOverlay({ showFps, showSpeed, speed }: StatsOverlayProps) {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!showFps) return
    let raf = 0, frames = 0, last = performance.now()
    const loop = () => {
      frames++
      const now = performance.now()
      if (now - last >= FPS_WINDOW_MS) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [showFps])

  if (!showFps && !showSpeed) return null
  return (
    <div style={wrap}>
      {showFps && <div>{fps} FPS</div>}
      {showSpeed && <div>{speed.toFixed(1)} ед/с</div>}
    </div>
  )
}
