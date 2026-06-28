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
    let W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2
    const bands = new Float32Array(BANDS)
    const sm = new Float32Array(BANDS)
    let raf = 0, phase = 0, lvl = 0

    const trace = (comps: Comp[], R: number, rot: number, amp: number) => {
      const pass: [string, number, number][] = [['rgba(120,195,255,0.5)', 2, 0], ['rgba(230,248,255,0.92)', 1, 0]]
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
      // keep the drawing buffer 1:1 with the displayed size → the oscilloscope never stretches with the window
      const cw = canvas.clientWidth, ch = canvas.clientHeight
      if (cw && ch && (canvas.width !== cw || canvas.height !== ch)) { canvas.width = cw; canvas.height = ch }
      W = canvas.width; H = canvas.height; cx = W / 2; cy = H / 2
      const on = !!engine?.isReady && active
      // readBands MAX-combines into out and never decays it — so it MUST be cleared each frame, else the bands
      // pin at their running peak and the visual freezes into one constant loop (looks like a canned animation).
      bands.fill(0)
      if (on) { engine!.readBands(bands); lvl += (engine!.readLevel() - lvl) * 0.35 } else { lvl += (0 - lvl) * 0.06 }
      // punchy attack, slower release → the ball "hits" on transients and eases back on calm passages
      for (let i = 0; i < BANDS; i++) { const a = bands[i] > sm[i] ? 0.6 : 0.16; sm[i] += (bands[i] - sm[i]) * a }
      const bass = avg(sm, 0, 6), mid = avg(sm, 6, 15), high = avg(sm, 15, BANDS)
      const energy = bass + mid + high
      // compressed range: a higher floor (never dead-still) + a lower ceiling (energetic ≠ tangled mush)
      phase += 0.006 + bass * 0.028 + mid * 0.02 + high * 0.012
      // clean redraw each frame (no trail accumulation, no bloom) — crisp thin lines over the frosted glass
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      const base = Math.min(W, H) * 0.16 * (0.72 + bass * 0.8 + lvl * 0.4)
      const groups = [0.62 + bass * 0.85, 0.64 + mid * 0.95, 0.56 + high * 1.05]
      SETS.forEach((s, i) => trace(s, base, phase * (0.15 + i * 0.05) + i + energy * 0.22, Math.min(1.35, groups[i])))
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [engine, active])

  return <canvas ref={ref} width={612} height={372} className="rexp-vis" data-testid="radio-visualizer" />
}
