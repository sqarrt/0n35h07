import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShieldSystem } from '../../src/hooks/useShieldSystem'

const DURATION = 800
const COOLDOWN = 2000

function lockPointer() {
  Object.defineProperty(document, 'pointerLockElement', {
    get: () => document.body,
    configurable: true,
  })
}

function unlockPointer() {
  Object.defineProperty(document, 'pointerLockElement', {
    get: () => null,
    configurable: true,
  })
}

describe('useShieldSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    lockPointer()
  })
  afterEach(() => {
    vi.useRealTimers()
    unlockPointer()
  })

  it('isActive() = false изначально', () => {
    const { result } = renderHook(() => useShieldSystem({ duration: DURATION, cooldown: COOLDOWN }))
    expect(result.current.isActive()).toBe(false)
  })

  it('activate() включает щит', () => {
    const { result } = renderHook(() => useShieldSystem({ duration: DURATION, cooldown: COOLDOWN }))
    act(() => { result.current.activate() })
    expect(result.current.isActive()).toBe(true)
  })

  it('activate() игнорируется если щит уже активен', () => {
    const onActivate = vi.fn()
    const { result } = renderHook(() =>
      useShieldSystem({ duration: DURATION, cooldown: COOLDOWN, onActivate })
    )
    act(() => { result.current.activate() })
    act(() => { result.current.activate() })
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('activate() игнорируется во время кулдауна', () => {
    const onActivate = vi.fn()
    const { result } = renderHook(() =>
      useShieldSystem({ duration: DURATION, cooldown: COOLDOWN, onActivate })
    )
    act(() => { result.current.activate() })
    act(() => { vi.advanceTimersByTime(DURATION + 100) }) // щит закончился, кулдаун
    act(() => { result.current.activate() })
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('getProgress() = 1 в покое', () => {
    const { result } = renderHook(() => useShieldSystem({ duration: DURATION, cooldown: COOLDOWN }))
    expect(result.current.getProgress(Date.now())).toBe(1)
  })

  it('getProgress() < 1 во время кулдауна', () => {
    const { result } = renderHook(() => useShieldSystem({ duration: DURATION, cooldown: COOLDOWN }))
    act(() => { result.current.activate() })
    act(() => { vi.advanceTimersByTime(DURATION + 100) }) // в кулдауне
    expect(result.current.getProgress(Date.now())).toBeLessThan(1)
  })
})
