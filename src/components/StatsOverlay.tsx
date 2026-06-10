import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

// Угол: ниже угловой скобки щита (90px скобка + отступ от кромки) — не перекрывает её и не «прыгает».
const TOP = 116
const LEFT = 22
const FPS_WINDOW_MS = 500   // окно усреднения FPS / худшего кадра

// График времени кадра (мс): спайк = пик. Усреднённый FPS его сглаживает, поэтому рисуем per-frame.
const GRAPH_W = 150
const GRAPH_H = 46
const HISTORY = GRAPH_W           // одна точка на пиксель ширины
const MS_TOP = 33.3               // верх графика = 33.3 мс (30 FPS); ниже — быстрее
const MS_120 = 1000 / 120         // 8.33 мс — бюджет кадра при 120 FPS
const MS_60 = 1000 / 60           // 16.67 мс — бюджет при 60 FPS

const wrap: CSSProperties = {
  position: 'fixed', top: TOP, left: LEFT, zIndex: 12, pointerEvents: 'none',
  fontFamily: 'var(--ui-font)', fontSize: 13, lineHeight: 1.5, letterSpacing: '0.08em',
  color: 'var(--accent)', textShadow: '0 0 6px rgba(0,0,0,0.85)',
}

interface StatsOverlayProps { showFps: boolean; showSpeed: boolean; speed: number }

/** Оверлей отладки: счётчик FPS + график времени кадра (видно спайки) + текущая скорость игрока. */
export function StatsOverlay({ showFps, showSpeed, speed }: StatsOverlayProps) {
  const [fps, setFps] = useState(0)
  const [worstMs, setWorstMs] = useState(0)   // макс время кадра за окно → минимальный FPS (показывает спайк)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!showFps) return
    const hist = new Float32Array(HISTORY)
    let head = 0
    let raf = 0, frames = 0, last = performance.now(), prev = last, windowMax = 0

    const draw = () => {
      const cv = canvasRef.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      if (cv.width !== GRAPH_W * dpr) { cv.width = GRAPH_W * dpr; cv.height = GRAPH_H * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, GRAPH_W, GRAPH_H)
      // фон
      ctx.fillStyle = 'rgba(8,12,18,0.55)'
      ctx.fillRect(0, 0, GRAPH_W, GRAPH_H)
      const y = (ms: number) => GRAPH_H - Math.min(ms, MS_TOP) / MS_TOP * GRAPH_H
      // пороги 120 / 60 FPS
      ctx.strokeStyle = 'rgba(120,180,255,0.25)'; ctx.lineWidth = 1
      for (const ms of [MS_120, MS_60]) { ctx.beginPath(); ctx.moveTo(0, y(ms)); ctx.lineTo(GRAPH_W, y(ms)); ctx.stroke() }
      // линия времени кадра (от старого к новому слева→направо)
      ctx.strokeStyle = '#4af'; ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < HISTORY; i++) {
        const ms = hist[(head + i) % HISTORY]
        const px = i, py = y(ms)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    const loop = () => {
      const now = performance.now()
      const ft = now - prev; prev = now
      hist[head] = ft; head = (head + 1) % HISTORY
      windowMax = Math.max(windowMax, ft)
      frames++
      if (now - last >= FPS_WINDOW_MS) {
        setFps(Math.round((frames * 1000) / (now - last)))
        setWorstMs(windowMax)
        frames = 0; last = now; windowMax = 0
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [showFps])

  if (!showFps && !showSpeed) return null
  const worstFps = worstMs > 0 ? Math.round(1000 / worstMs) : 0
  return (
    <div style={wrap}>
      {showFps && (
        <>
          <div>{fps} FPS · мин {worstFps} ({worstMs.toFixed(1)} мс)</div>
          <canvas ref={canvasRef} style={{ width: GRAPH_W, height: GRAPH_H, display: 'block', marginTop: 3 }} />
        </>
      )}
      {showSpeed && <div style={{ marginTop: showFps ? 3 : 0 }}>{speed.toFixed(1)} ед/с</div>}
    </div>
  )
}
