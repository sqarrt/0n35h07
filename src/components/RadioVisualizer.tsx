import { useEffect, useRef } from 'react'
import type { IStrudelEngine } from '../radio/music/IStrudelEngine'
import { VIZ_CONCRETE, VIZ_ROTATE_FRAMES, type VizMode } from './radioViz'

// Audio-reactive visualizers behind the (translucent) explorer. All read the master analyser (level + spectrum),
// draw crisp cyan shapes on a transparent canvas (so the frosted glass shows through), 1:1 buffer (no stretch).
const BANDS = 24
const SEG = 360
const avg = (a: Float32Array, lo: number, hi: number) => { let s = 0; for (let i = lo; i < hi; i++) s += a[i]; return s / (hi - lo) }

const IMPULSE_DECAY = 0.84, IMPULSE_GAIN = 4.5
const FIELD_N = 90

// Base Lissajous components for the oscilloscope (sum-of-sines for x/y).
type Comp = { ax: number; ay: number; fx: number; fy: number; px: number; py: number }
const SETS: Comp[][] = [
  [{ ax: .82, ay: .72, fx: 3, fy: 2, px: .2, py: .5 }, { ax: .42, ay: .46, fx: 7, fy: 5, px: 1.1, py: .3 }, { ax: .2, ay: .26, fx: 11, fy: 13, px: 2, py: 1.4 }],
  [{ ax: .7, ay: .84, fx: 2, fy: 3, px: 1, py: 0 }, { ax: .46, ay: .4, fx: 5, fy: 8, px: .4, py: 2 }, { ax: .22, ay: .2, fx: 14, fy: 10, px: .7, py: .9 }],
  [{ ax: .76, ay: .74, fx: 4, fy: 4, px: .6, py: 1.6 }, { ax: .34, ay: .52, fx: 9, fy: 6, px: 1.5, py: .2 }, { ax: .18, ay: .22, fx: 12, fy: 15, px: .3, py: 2.4 }],
]

interface RadioVisualizerProps { engine: IStrudelEngine | null; active: boolean; mode: VizMode }

export function RadioVisualizer({ engine, active, mode }: RadioVisualizerProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode // read live in the loop → switching mode never re-inits the canvas

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2
    const bands = new Float32Array(BANDS), sm = new Float32Array(BANDS)
    let raf = 0, phase = 0, lvl = 0, bassEnv = 0, impulse = 0, frame = 0
    let bass = 0, mid = 0, high = 0, energy = 0
    // particle field state
    const px = new Float32Array(FIELD_N), py = new Float32Array(FIELD_N), pvx = new Float32Array(FIELD_N), pvy = new Float32Array(FIELD_N)
    for (let i = 0; i < FIELD_N; i++) { px[i] = Math.random(); py[i] = Math.random(); const a = Math.random() * 6.283; const sp = 0.0004 + Math.random() * 0.0006; pvx[i] = Math.cos(a) * sp; pvy[i] = Math.sin(a) * sp }

    const trace = (comps: Comp[], R: number, rot: number, amp: number, jit: number) => {
      const pass: [string, number][] = [['rgba(120,195,255,0.5)', 2], ['rgba(230,248,255,0.92)', 1]]
      const cos = Math.cos(rot), sin = Math.sin(rot)
      for (const [col, w] of pass) {
        ctx.beginPath()
        for (let i = 0; i <= SEG; i++) {
          const tt = (i / SEG) * Math.PI * 2
          let x = 0, y = 0
          for (const c of comps) { x += c.ax * Math.sin(c.fx * tt + c.px + phase); y += c.ay * Math.cos(c.fy * tt + c.py + phase) }
          x += Math.sin(tt * 27 + phase * 9) * jit; y += Math.cos(tt * 23 + phase * 11) * jit
          x *= amp; y *= amp
          const X = cx + (x * cos - y * sin) * R, Y = cy + (x * sin + y * cos) * R
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y)
        }
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'miter'; ctx.stroke()
      }
    }
    const drawScope = () => {
      const punch = 1 + impulse * 0.55
      const base = Math.min(W, H) * 0.16 * (0.66 + bass * 1.0 + lvl * 0.5) * punch
      const groups = [0.5 + bass * 1.25, 0.52 + mid * 1.35, 0.44 + high * 1.6]
      const jit = high * 0.35 + impulse * 0.45
      SETS.forEach((s, i) => trace(s, base, phase * (0.15 + i * 0.05) + i + energy * 0.3 + impulse * 0.7, Math.min(1.7, groups[i] * punch), jit))
    }
    const drawBars = () => {
      const bw = W / BANDS
      for (let i = 0; i < BANDS; i++) {
        const v = sm[i], h = v * H * 0.72
        ctx.fillStyle = `rgba(120,200,255,${0.22 + v * 0.55})`
        ctx.fillRect(i * bw + 1, (H - h) / 2, bw - 2, h)
      }
    }
    const drawRadial = () => {
      const R0 = Math.min(W, H) * 0.11, MAX = Math.min(W, H) * 0.34
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(phase * 0.25 + impulse)
      ctx.lineWidth = 2; ctx.lineCap = 'round'
      for (let i = 0; i < BANDS; i++) {
        const a = (i / BANDS) * Math.PI * 2, len = R0 + sm[i] * MAX
        ctx.strokeStyle = `rgba(130,205,255,${0.3 + sm[i] * 0.55})`
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * R0, Math.sin(a) * R0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke()
      }
      ctx.restore()
    }
    const drawField = () => {
      const spd = 1 + impulse * 6, r = 0.6 + bass * 4 + impulse * 3.5
      ctx.fillStyle = `rgba(140,210,255,${0.22 + high * 0.5})`
      for (let i = 0; i < FIELD_N; i++) {
        px[i] = (px[i] + pvx[i] * spd + 1) % 1; py[i] = (py[i] + pvy[i] * spd + 1) % 1
        ctx.beginPath(); ctx.arc(px[i] * W, py[i] * H, r, 0, 6.283); ctx.fill()
      }
    }

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const cw = canvas.clientWidth, ch = canvas.clientHeight
      if (cw && ch && (canvas.width !== cw || canvas.height !== ch)) { canvas.width = cw; canvas.height = ch }
      W = canvas.width; H = canvas.height; cx = W / 2; cy = H / 2

      const on = !!engine?.isReady && active
      bands.fill(0)
      let rawLvl = 0
      if (on) { engine!.readBands(bands); rawLvl = engine!.readLevel() }
      let rawBands = 0; for (let i = 0; i < BANDS; i++) rawBands += bands[i]
      const silent = rawLvl < 0.015 && rawBands < 0.4
      lvl += (rawLvl - lvl) * (silent ? 0.04 : 0.4)
      const rel = silent ? 0.035 : 0.22
      for (let i = 0; i < BANDS; i++) { const a = bands[i] > sm[i] ? 0.85 : rel; sm[i] += (bands[i] - sm[i]) * a }
      bass = avg(sm, 0, 6); mid = avg(sm, 6, 15); high = avg(sm, 15, BANDS); energy = bass + mid + high
      bassEnv += (bass - bassEnv) * (bass > bassEnv ? 0.35 : 0.05)
      impulse = Math.max(impulse * IMPULSE_DECAY, Math.min(1, Math.max(0, bass - bassEnv) * IMPULSE_GAIN))
      phase += 0.006 + bass * 0.03 + mid * 0.022 + high * 0.014 + impulse * 0.07

      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      const m = modeRef.current
      const cur = m === 'auto' ? VIZ_CONCRETE[Math.floor(frame / VIZ_ROTATE_FRAMES) % VIZ_CONCRETE.length] : m
      frame++
      if (cur === 'scope') drawScope()
      else if (cur === 'bars') drawBars()
      else if (cur === 'radial') drawRadial()
      else drawField()
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [engine, active])

  return <canvas ref={ref} width={612} height={372} className="rexp-vis" data-testid="radio-visualizer" />
}
