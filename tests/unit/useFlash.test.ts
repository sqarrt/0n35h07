import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFlash } from '../../src/hooks/useFlash'

describe('useFlash', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('trigger() активирует флаш', () => {
    const { result } = renderHook(() => useFlash(200))
    const [, trigger] = result.current
    act(() => { trigger() })
    const [active] = result.current
    expect(active).toBe(true)
  })

  it('флаш деактивируется после duration', () => {
    const { result } = renderHook(() => useFlash(200))
    const [, trigger] = result.current
    act(() => { trigger() })
    act(() => { vi.advanceTimersByTime(200) })
    const [active] = result.current
    expect(active).toBe(false)
  })

  it('повторный trigger() сбрасывает таймер', () => {
    const { result } = renderHook(() => useFlash(200))
    const [, trigger] = result.current
    act(() => { trigger() })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { trigger() })
    // После 150ms от второго trigger (250ms от первого) — всё ещё активен
    act(() => { vi.advanceTimersByTime(150) })
    const [active] = result.current
    expect(active).toBe(true)
  })
})
