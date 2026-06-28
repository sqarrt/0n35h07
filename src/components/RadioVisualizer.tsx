import { useEffect, useRef } from 'react'
import type { IStrudelEngine } from '../radio/music/IStrudelEngine'

// An audio-reactive oscilloscope: a glowing cyan Lissajous "energy ball" whose loops breathe with the music —
// bass swells the whole tangle + the hot core, mids drive the main loops, highs spark the fine detail. Sits dim
// behind the (translucent) explorer. Reads the master analyser via the engine (readLevel / readBands).
const BANDS = 24
const SEG = 360
const avg = (a: Float32Array, lo: number, hi: number) => { let s = 0; for (let i = lo; i < hi; i++) s += a[i]; return s / (hi - lo) }

// Base Lissajous components (sum-of-sines for x/y). Each trace's amplitude is scaled per-frame by a band group.
type Comp = { ax: number; ay: number; fx: number; fy: number; px: number; py: number }
const SETS: Comp[][] = [
  [{ ax: .82, ay: .72, fx: 3, fy: 2, px: .2, py: .5 }, { ax: .42, ay: .46, fx: 7, fy: 5, px: 1.1, py: .3 }, { ax: .2, ay: .26, fx: 11, fy: 13, px: 2, py: 1.4 }],
  [{ ax: .7, ay: .84, fx: 2, fy: 3, px: 1, py: 0 }, { ax: .46, ay: .4, fx: 5, fy: 8, px: .4, py: 2 }, { ax: .22, ay: .2, fx: 14, fy: 10, px: .7, py: .9 }],
  [{ ax: .76, ay: .74, fx: 4, fy: 4, px: .6, py: 1.6 }, { ax: .34, ay: .52, fx: 9, fy: 6, px: 1.5, py: .2 }, { ax: .18, ay: .22, fx: 12, fy: 15, px: .3, py: 2.4 }],
]

interface RadioVisualizerProps { engine: IStrudelEngine | null; active: boolean }

export function RadioVisualizer({ engine, active }: RadioVisualizerProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2
    const bands = new Float32Array(BANDS)
    const sm = new Float32Array(BANDS)
    let raf = 0, phase = 0, lvl = 0

    const trace = (comps: Comp[], R: number, rot: number, amp: number) => {
      const pass: [string, number, number][] = [['rgba(70,160,255,0.30)', 8, 26], ['rgba(150,215,255,0.55)', 2.4, 16], ['rgba(225,248,255,0.85)', 1, 8]]
      const cos = Math.cos(rot), sin = Math.sin(rot)
      for (const [col, w, glow] of pass) {
        ctx.beginPath()
        for (let i = 0; i <= SEG; i++) {
          const tt = (i / SEG) * Math.PI * 2
          let px = 0, py = 0
          for (const c of comps) { px += c.ax * Math.sin(c.fx * tt + c.px + phase); py += c.ay * Math.cos(c.fy * tt + c.py + phase) }
          px *= amp; py *= amp
          const X = cx + (px * cos - py * sin) * R, Y = cy + (px * sin + py * cos) * R
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y)
        }
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = '#6cf'; ctx.shadowBlur = glow; ctx.lineJoin = 'round'; ctx.stroke()
      }
    }

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const on = !!engine?.isReady && active
      if (on) { engine!.readBands(bands); lvl += (engine!.readLevel() - lvl) * 0.2 } else { bands.fill(0); lvl += (0 - lvl) * 0.05 }
      for (let i = 0; i < BANDS; i++) sm[i] += (bands[i] - sm[i]) * 0.3
      const bass = avg(sm, 0, 6), mid = avg(sm, 6, 15), high = avg(sm, 15, BANDS)
      phase += 0.004 + mid * 0.03
      // motion-trail decay (instead of a hard clear) → the loops smear into a glowing afterimage
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(5,7,11,0.26)'; ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      const base = Math.min(W, H) * 0.16 * (0.55 + bass * 1.1 + lvl * 0.5)
      const groups = [0.35 + bass * 1.3, 0.4 + mid * 1.5, 0.3 + high * 1.8]
      SETS.forEach((s, i) => trace(s, base, phase * (0.15 + i * 0.05) + i, Math.min(1.4, groups[i])))
      // hot core, sized by overall level
      ctx.shadowBlur = 30 + lvl * 40; ctx.shadowColor = '#bdf'; ctx.fillStyle = `rgba(220,245,255,${0.4 + lvl * 0.5})`
      ctx.beginPath(); ctx.arc(cx, cy, 2 + bass * 6 + lvl * 3, 0, Math.PI * 2); ctx.fill()
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [engine, active])

  return <canvas ref={ref} width={612} height={372} className="rexp-vis" data-testid="radio-visualizer" />
}
