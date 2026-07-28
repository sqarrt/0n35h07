import { useEffect, useRef, useState } from 'react'
import { HUD_FRAME_INSET } from '../constants'

/**
 * Dash indicator — vertical bars on the sides that continue the shield's corner L-frames
 * (slightly offset from them). They fill from center to edges as the cooldown recovers
 * (dim green while charging, calm green when full). The moment dash becomes ready, the bars
 * briefly flash (glow), then burn steadily — no constant glow.
 */
const FLASH = '@keyframes dashReadyFlash {' +
  '0% { box-shadow: 0 0 0 rgba(46,157,87,0) }' +
  '35% { box-shadow: 0 0 10px rgba(46,157,87,0.85) }' +
  '100% { box-shadow: 0 0 0 rgba(46,157,87,0) } }'

function Strip({ side, pct, ready, flash }: { side: 'left' | 'right'; pct: number; ready: boolean; flash: boolean }) {
  return (
    <div style={{
      position: 'fixed', top: '50%', height: 'calc(100vh / 3)', transform: 'translateY(-50%)', width: 6,
      left:  side === 'left'  ? HUD_FRAME_INSET : undefined,
      right: side === 'right' ? HUD_FRAME_INSET : undefined,
      background: 'rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 11,
    }}>
      <div style={{
        width: '100%', height: `${pct}%`,
        background: ready ? '#2e9d57' : '#0c4d28',
        opacity: ready ? 1 : 0.55,
        animation: flash ? 'dashReadyFlash 0.6s ease-out' : 'none',
        transition: 'height 0.05s linear',
      }} />
    </div>
  )
}

export function DashIndicator({ dashProgress }: { dashProgress: number }) {
  const ready = dashProgress >= 1
  const [flash, setFlash] = useState(false)
  const prevReady = useRef(true)   // dash is ready at start — no flash

  useEffect(() => {
    if (ready && !prevReady.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      prevReady.current = true
      return () => clearTimeout(t)
    }
    if (!ready) prevReady.current = false
  }, [ready])

  const pct = Math.min(1, Math.max(0, dashProgress)) * 100
  return (
    <>
      <style>{FLASH}</style>
      <Strip side="left"  pct={pct} ready={ready} flash={flash} />
      <Strip side="right" pct={pct} ready={ready} flash={flash} />
    </>
  )
}
