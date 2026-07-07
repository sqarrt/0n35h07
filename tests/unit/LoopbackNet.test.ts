import { describe, it, expect, vi } from 'vitest'
import { createLoopbackPair, createLoopbackHub } from '../../src/net/LoopbackNet'

describe('LoopbackNet', () => {
  it('broadcast reaches the other endpoint with from=sender', () => {
    const [host, client] = createLoopbackPair('host', 'client')
    const got = vi.fn()
    client.on('input', got)
    host.broadcast('input', { seq: 1 })
    expect(got).toHaveBeenCalledWith({ seq: 1 }, 'host')
  })

  it('on(tag) filters by tag', () => {
    const [host, client] = createLoopbackPair()
    const onInput = vi.fn()
    const onSnap = vi.fn()
    client.on('input', onInput)
    client.on('snapshot', onSnap)
    host.broadcast('snapshot', { ackSeq: 0, players: [] })
    expect(onSnap).toHaveBeenCalledOnce()
    expect(onInput).not.toHaveBeenCalled()
  })

  it('send delivers only to the addressee', () => {
    const [host, client] = createLoopbackPair('host', 'client')
    const got = vi.fn()
    client.on('event', got)
    host.send('client', 'event', { t: 'kill' })
    expect(got).toHaveBeenCalledOnce()
    host.send('nobody', 'event', { t: 'kill' })
    expect(got).toHaveBeenCalledOnce()   // did not grow
  })

  it('onPeerJoin sees the present peer; peers() returns it', () => {
    const [host] = createLoopbackPair('host', 'client')
    const join = vi.fn()
    host.onPeerJoin(join)
    expect(join).toHaveBeenCalledWith('client')
    expect(host.peers()).toEqual(['client'])
  })
})

describe('createLoopbackHub — N peers, everyone hears everyone', () => {
  it('broadcast reaches ALL other endpoints', () => {
    const [a, b, c] = createLoopbackHub(['A', 'B', 'C'])
    const gotB = vi.fn(); const gotC = vi.fn()
    b.on('event', gotB); c.on('event', gotC)
    a.broadcast('event', { t: 'kill' })
    expect(gotB).toHaveBeenCalledWith({ t: 'kill' }, 'A')
    expect(gotC).toHaveBeenCalledWith({ t: 'kill' }, 'A')
  })

  it('send targets exactly one peer; peers() lists the others', () => {
    const [a, b, c] = createLoopbackHub(['A', 'B', 'C'])
    const gotB = vi.fn(); const gotC = vi.fn()
    b.on('event', gotB); c.on('event', gotC)
    a.send('C', 'event', { t: 'kill' })
    expect(gotC).toHaveBeenCalledOnce()
    expect(gotB).not.toHaveBeenCalled()
    expect(a.peers().sort()).toEqual(['B', 'C'])
  })

  it('triggerLeave(peerId) fires the leave callback for that peer only', () => {
    const [a, , c] = createLoopbackHub(['A', 'B', 'C'])
    const left = vi.fn()
    a.onPeerLeave(left)
    a.triggerLeave('C')
    expect(left).toHaveBeenCalledWith('C')
    expect(left).toHaveBeenCalledOnce()
    void c
  })
})
