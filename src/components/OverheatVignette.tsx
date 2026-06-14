import { useEffect, useRef } from 'react'
import type { StreakTier } from '../game/streak'

// Интенсивности по тиру (из макета overheat-vignette-v3.html). Периоды разрядов УВЕЛИЧЕНЫ ×3 (молнии реже).
const CFG: Record<StreakTier, { a: number; r: number; pulse: number; perSide: number; lmin: number; lmax: number; dmin: number; dmax: number }> = {
  double:      { a: 0.05,  r: 40, pulse: 3.2, perSide: 3,  lmin: 22, lmax: 34, dmin: 7.8, dmax: 10.2 },
  triple:      { a: 0.085, r: 58, pulse: 2.4, perSide: 6,  lmin: 26, lmax: 40, dmin: 5.7, dmax: 7.8 },
  singularity: { a: 0.14,  r: 78, pulse: 1.7, perSide: 10, lmin: 28, lmax: 46, dmin: 3.6, dmax: 5.7 },
}

/** Зазубренная линия (midpoint displacement) + форки → реалистичная молния. */
function jag(x0: number, y0: number, x1: number, y1: number, disp: number, w: number, out: { d: string; w: number }[]) {
  if (disp < 2.0) { out.push({ d: `M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}`, w }); return }
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1
  const off = (Math.random() * 2 - 1) * disp
  const nx = (x0 + x1) / 2 - dy / len * off, ny = (y0 + y1) / 2 + dx / len * off
  jag(x0, y0, nx, ny, disp / 2, w, out); jag(nx, ny, x1, y1, disp / 2, w, out)
  if (w > 0.6 && Math.random() < 0.4) {
    const ang = Math.atan2(dy, dx) + (Math.random() < .5 ? -1 : 1) * (0.5 + Math.random() * 0.6)
    const bl = len * (0.4 + Math.random() * 0.35)
    jag(nx, ny, nx + Math.cos(ang) * bl, ny + Math.sin(ang) * bl, disp / 2, w * 0.5, out)
  }
}
function boltSVG(len: number): string {
  const H = 34, out: { d: string; w: number }[] = []
  jag(0, H / 2, len, H / 2 + (Math.random() * 2 - 1) * 5, len * 0.2, 1.5, out)
  return `<svg width="${len}" height="${H}" viewBox="0 0 ${len} ${H}">` +
    out.map(p => `<path d="${p.d}" stroke-width="${p.w.toFixed(2)}"/>`).join('') + '</svg>'
}

/** Виньетка ПЕРЕГРЕВА своему игроку: красные края + молнии по тиру серии. tier=null — не показываем. */
export function OverheatVignette({ tier }: { tier: StreakTier | null }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el || !tier) return
    const c = CFG[tier]
    el.style.setProperty('--a', String(c.a)); el.style.setProperty('--r', `${c.r}px`); el.style.setProperty('--pulse', `${c.pulse}s`)
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const timers: ReturnType<typeof setInterval>[] = []
    const bolts: HTMLDivElement[] = []
    for (const side of ['l', 'r'] as const) {
      for (let i = 0; i < c.perSide; i++) {
        const b = document.createElement('div'); b.className = 'ov-bolt'
        const pos = Math.max(4, Math.min(96, (i + 0.5) / c.perSide * 100 + rnd(-6, 6)))
        const dur = rnd(c.dmin, c.dmax), len = rnd(c.lmin, c.lmax)
        b.style.cssText = `${side === 'l' ? 'left:-2px' : 'right:-2px'};top:${pos}%;transform:translateY(-50%)${side === 'r' ? ' scaleX(-1)' : ''};animation:ov-strike ${dur}s infinite ${rnd(0, dur)}s`
        const draw = () => { b.innerHTML = boltSVG(len) }
        draw(); timers.push(setInterval(draw, dur * 1000))
        el.appendChild(b); bolts.push(b)
      }
    }
    return () => { timers.forEach(clearInterval); bolts.forEach(b => b.remove()) }
  }, [tier])
  if (!tier) return null
  return <div ref={root} className="overheat-vig" data-testid="overheat-vignette" data-tier={tier} />
}
