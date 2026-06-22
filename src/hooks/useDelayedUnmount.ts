import { useState, useEffect } from 'react'

/**
 * Keeps the element mounted for an extra `exitMs` after `show` becomes false — so the fade-out can
 * play before unmounting. Returns whether the element should currently be rendered.
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
