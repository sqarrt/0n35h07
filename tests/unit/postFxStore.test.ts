import { describe, it, expect, vi } from 'vitest'
import { getPostFx, setPostFx, subscribePostFx } from '../../src/postFxStore'

describe('postFxStore', () => {
  it('set/get, notifies on change only, and stops after unsubscribe', () => {
    setPostFx(false)
    const listener = vi.fn()
    const unsub = subscribePostFx(listener)

    setPostFx(true)
    expect(getPostFx()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    setPostFx(true)                       // no change → no notify
    expect(listener).toHaveBeenCalledTimes(1)

    unsub()
    setPostFx(false)
    expect(getPostFx()).toBe(false)       // value still updates
    expect(listener).toHaveBeenCalledTimes(1)   // but the unsubscribed listener isn't called
  })
})
