import { useState, useRef, useCallback } from 'react'

/** Как useFlash, но хранит payload и сам гасит его в null через duration. trigger(null) — мгновенный сброс. */
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
