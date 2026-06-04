import { useRef, useEffect } from 'react'
import { MENU_ANIM_TAU } from '../constants'

/**
 * Демпфированный горизонтальный переезд DOM-элемента к целевому смещению (px). Та же формула/скорость, что
 * у фоновых шаров (MENU_ANIM_TAU) → подложка едет синхронно с моделями. Первый кадр — сразу в цели (без
 * проезда при загрузке); смена цели запускает плавный переезд через requestAnimationFrame, петля гаснет при
 * оседании. Возвращает ref для элемента.
 */
export function useDampedTranslateX(targetPx: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const cur = useRef<number | null>(null)   // null → ещё не инициализирован
  const target = useRef(targetPx)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    target.current = targetPx
    const apply = (x: number) => { if (ref.current) ref.current.style.transform = `translateX(${x}px)` }

    if (cur.current === null) {   // первый кадр — без проезда
      cur.current = targetPx
      apply(targetPx)
      return
    }
    if (rafId.current !== null) return   // петля уже идёт — подхватит новый target

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
