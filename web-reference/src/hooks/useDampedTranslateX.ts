import { useRef, useEffect } from 'react'
import { MENU_ANIM_TAU } from '../constants'

/**
 * Damped horizontal travel of a DOM element toward a target offset (px). Same formula/speed as the
 * background orbs (MENU_ANIM_TAU) → the backdrop moves in sync with the models. First frame snaps to the
 * target (no travel on load); changing the target starts a smooth travel via requestAnimationFrame, the
 * loop dies once it settles. Returns a ref for the element.
 */
export function useDampedTranslateX(targetPx: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const cur = useRef<number | null>(null)   // null → not yet initialized
  const target = useRef(targetPx)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    target.current = targetPx
    const apply = (x: number) => { if (ref.current) ref.current.style.transform = `translateX(${x}px)` }

    if (cur.current === null) {   // first frame — no travel
      cur.current = targetPx
      apply(targetPx)
      return
    }
    if (rafId.current !== null) return   // loop already running — it will pick up the new target

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); last = now
      const next = cur.current! + (target.current - cur.current!) * (1 - Math.exp(-dt / MENU_ANIM_TAU))
      cur.current = next
      if (Math.abs(target.current - next) < 0.5) {
        cur.current = target.current
        apply(target.current)
        rafId.current = null
        return
      }
      apply(next)
      rafId.current = requestAnimationFrame(tick)
    }
    rafId.current = requestAnimationFrame(tick)
  }, [targetPx])

  useEffect(() => () => { if (rafId.current !== null) cancelAnimationFrame(rafId.current) }, [])

  return ref
}
