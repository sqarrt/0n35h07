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

const IMPULSE_DECAY = 0.84   // how fast a beat "punch" relaxes
const IMPULSE_GAIN = 4.5     // how hard a bass onset hits

interface RadioVisualizerProps { engine: IStrudelEngine | null; active: boolean }

export function RadioVisualizer({ engine, active }: RadioVisualizerProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2
    const bands = new Float32Array(BANDS)
    const sm = new Float32Array(BANDS)
    let raf = 0, phase = 0, lvl = 0, bassEnv = 0, impulse = 0

    const trace = (comps: Comp[], R: number, rot: number, amp: number, jit: number) => {
      const pass: [string, number][] = [['rgba(120,195,255,0.5)', 2], ['rgba(230,248,255,0.92)', 1]]
      const cos = Math.cos(rot), sin = Math.sin(rot)
      for (const [col, w] of pass) {
        ctx.beginPath()
        for (let i = 0; i <= SEG; i++) {
          const tt = (i / SEG) * Math.PI * 2
          let px = 0, py = 0
          for (const c of comps) { px += c.ax * Math.sin(c.fx * tt + c.px + phase); py += c.ay * Math.cos(c.fy * tt + c.py + phase) }
          // high-frequency buzz → jagged, nervous lines on energetic highs / beat punches (not clean sine loops)
          px += Math.sin(tt * 27 + phase * 9) * jit
          py += Math.cos(tt * 23 + phase * 11) * jit
          px *= amp; py *= amp
          const X = cx + (px * cos - py * sin) * R, Y = cy + (px * sin + py * cos) * R
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y)
        }
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'miter'; ctx.stroke()
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
      if (on) { engine!.readBands(bands); lvl += (engine!.readLevel() - lvl) * 0.4 } else { lvl += (0 - lvl) * 0.04 }
      // fast attack (punchy) / slower release; on PAUSE wind down gently (rel→small) so it eases into idle, no snap
      const rel = on ? 0.22 : 0.04
      for (let i = 0; i < BANDS; i++) { const a = bands[i] > sm[i] ? 0.85 : rel; sm[i] += (bands[i] - sm[i]) * a }
      const bass = avg(sm, 0, 6), mid = avg(sm, 6, 15), high = avg(sm, 15, BANDS)
      const energy = bass + mid + high
      // beat punch: a bass onset above its slow envelope fires an impulse that decays → the ball JOLTS on hits
      bassEnv += (bass - bassEnv) * (bass > bassEnv ? 0.35 : 0.05)
      impulse = Math.max(impulse * IMPULSE_DECAY, Math.min(1, Math.max(0, bass - bassEnv) * IMPULSE_GAIN))
      phase += 0.006 + bass * 0.03 + mid * 0.022 + high * 0.014 + impulse * 0.07
      // clean redraw each frame (no trail accumulation, no bloom) — crisp thin lines over the frosted glass
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      const punch = 1 + impulse * 0.55
      const base = Math.min(W, H) * 0.16 * (0.66 + bass * 1.0 + lvl * 0.5) * punch
      const groups = [0.5 + bass * 1.25, 0.52 + mid * 1.35, 0.44 + high * 1.6]
      const jit = high * 0.35 + impulse * 0.45   // jaggedness — buzzes on highs, spikes on beats
      SETS.forEach((s, i) => trace(s, base, phase * (0.15 + i * 0.05) + i + energy * 0.3 + impulse * 0.7, Math.min(1.7, groups[i] * punch), jit))
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [engine, active])

  return <canvas ref={ref} width={612} height={372} className="rexp-vis" data-testid="radio-visualizer" />
}
