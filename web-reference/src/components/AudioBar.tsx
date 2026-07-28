import { useEffect, useRef } from 'react'
import { HUD_FRAME_INSET } from '../constants'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'

const COLOR = '#4af'
const BANDS = 40              // frequency bands (per half of the line; line is symmetric from center)
const BAR_GAIN = 1.4         // visual spectrum gain
const SMOOTH_UP = 0.55       // fast attack
const SMOOTH_DOWN = 0.14     // smooth decay
const VB_W = 1200            // viewBox width (line stretches to the container)
const VB_H = 90              // viewBox height
const AMP = 78               // max line rise (in viewBox units)
const WIDTH_FRAC = 46        // container width, % of screen
const HEIGHT_PX = 42         // container height, px
const BAR_BOTTOM_OFFSET = 14 // above the bottom respawn bar

/**
 * Frequency-spectrum visualizer line (match music + effects): a thin glowing line at the bottom of the HUD,
 * jittering by frequency. Symmetric from center (bass at center, high frequencies toward the edges). Updated in rAF.
 */
export function AudioBar({ analysis }: { analysis: AudioAnalysis }) {
  const lineRef = useRef<SVGPolylineElement>(null)
  const raw = useRef(new Float32Array(BANDS))
  const cur = useRef(new Float32Array(BANDS))

  useEffect(() => {
    let id = 0
    const count = BANDS * 2 - 1            // symmetric: center = band 0 (bass), higher frequencies toward edges
    const center = BANDS - 1
    const tick = () => {
      analysis.bands(raw.current)
      const c = cur.current
      for (let i = 0; i < BANDS; i++) {
        const t = Math.min(1, raw.current[i] * BAR_GAIN)
        c[i] += (t - c[i]) * (t > c[i] ? SMOOTH_UP : SMOOTH_DOWN)
      }
      let pts = ''
      for (let k = 0; k < count; k++) {
        const v = c[Math.abs(k - center)]
        const x = (k / (count - 1)) * VB_W
        const y = VB_H - 1 - v * AMP
        pts += `${x.toFixed(1)},${y.toFixed(1)} `
      }
      lineRef.current?.setAttribute('points', pts)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [analysis])

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
      style={{
        position: 'fixed', left: '50%', bottom: HUD_FRAME_INSET + BAR_BOTTOM_OFFSET,
        transform: 'translateX(-50%)', width: `${WIDTH_FRAC}%`, height: HEIGHT_PX,
        pointerEvents: 'none', zIndex: 14, overflow: 'visible',
        filter: `drop-shadow(0 0 4px ${COLOR})`,
      }}
    >
      <polyline ref={lineRef} fill="none" stroke={COLOR} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
