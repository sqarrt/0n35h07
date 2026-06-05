import { useState, useEffect } from 'react'

/**
 * Держит элемент смонтированным ещё `exitMs` после того, как `show` стал false — чтобы успел отыграть
 * fade-out перед размонтированием. Возвращает, нужно ли сейчас рендерить элемент.
 */
export function useDelayedUnmount(show: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(show)
  useEffect(() => {
    if (show) { setMounted(true); return }
    const t = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(t)
  }, [show, exitMs])
  return mounted
}
