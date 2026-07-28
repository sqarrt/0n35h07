import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFlash } from '../../src/hooks/useFlash'

describe('useFlash', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('trigger() activates the flash', () => {
    const { result } = renderHook(() => useFlash(200))
    const [, trigger] = result.current
    act(() => { trigger() })
    const [active] = result.current
    expect(active).toBe(true)
  })

  it('flash deactivates after duration', () => {
    const { result } = renderHook(() => useFlash(200))
    const [, trigger] = result.current
    act(() => { trigger() })
    act(() => { vi.advanceTimersByTime(200) })
    const [active] = result.current
    expect(active).toBe(false)
  })

  it('repeated trigger() resets the timer', () => {
    const { result } = renderHook(() => useFlash(200))
    const [, trigger] = result.current
    act(() => { trigger() })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { trigger() })
    // 150ms after the second trigger (250ms after the first) — still active
    act(() => { vi.advanceTimersByTime(150) })
    const [active] = result.current
    expect(active).toBe(true)
  })
})
