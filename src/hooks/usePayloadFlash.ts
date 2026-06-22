import { useState, useRef, useCallback } from 'react'

/** Like useFlash, but holds a payload and clears it to null after duration. trigger(null) resets instantly. */
export function usePayloadFlash<T>(duration: number): [T | null, (v: T | null) => void] {
  const [val, setVal] = useState<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trigger = useCallback((v: T | null) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setVal(v)
    if (v !== null) timer.current = setTimeout(() => { timer.current = null; setVal(null) }, duration)
  }, [duration])
  return [val, trigger]
}
