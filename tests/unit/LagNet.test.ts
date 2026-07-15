import { describe, it, expect, vi } from 'vitest'
import { LagNet } from '../../src/net/LagNet'
import type { INet, NetHandler, PeerId } from '../../src/net/INet'

// A fake INet that records outgoing sends and lets us push fake inbound messages to registered handlers.
function fakeNet() {
  const handlers: Record<string, NetHandler[]> = {}
  return {
    selfId: 'self' as PeerId,
    sent: [] as { tag: string; payload: unknown; peer?: string }[],
    broadcast(tag: string, payload: unknown) { this.sent.push({ tag, payload }) },
    send(peer: string, tag: string, payload: unknown) { this.sent.push({ peer, tag, payload }) },
    on(tag: string, cb: NetHandler) { (handlers[tag] ||= []).push(cb) },
    onPeerJoin() {}, onPeerLeave() {}, peers() { return [] as PeerId[] }, leave() {},
    emit(tag: string, payload: unknown, from: PeerId) { (handlers[tag] || []).forEach(cb => cb(payload, from)) },
  }
}

describe('LagNet', () => {
  it('passes selfId straight through', () => {
    const net = new LagNet(fakeNet() as unknown as INet, 100, 0)
    expect(net.selfId).toBe('self')
  })

  it('delays outgoing broadcasts by lagMs (jitter 0)', () => {
    vi.useFakeTimers()
    const inner = fakeNet()
    const net = new LagNet(inner as unknown as INet, 100, 0)
    net.broadcast('snapshot', { tick: 1 })
    expect(inner.sent.length).toBe(0)                 // not sent yet
    vi.advanceTimersByTime(100)
    expect(inner.sent).toEqual([{ tag: 'snapshot', payload: { tick: 1 } }])
    vi.useRealTimers()
  })

  it('delays directed sends by lagMs', () => {
    vi.useFakeTimers()
    const inner = fakeNet()
    const net = new LagNet(inner as unknown as INet, 50, 0)
    net.send('peerX', 'hit', { shooter: 0 })
    expect(inner.sent.length).toBe(0)
    vi.advanceTimersByTime(50)
    expect(inner.sent).toEqual([{ peer: 'peerX', tag: 'hit', payload: { shooter: 0 } }])
    vi.useRealTimers()
  })

  it('delays incoming messages before the consumer sees them (preserving payload + from)', () => {
    vi.useFakeTimers()
    const inner = fakeNet()
    const net = new LagNet(inner as unknown as INet, 100, 0)
    const got: { p: unknown; from: PeerId }[] = []
    net.on('snapshot', (p, from) => got.push({ p, from }))
    inner.emit('snapshot', { tick: 7 }, 'host')
    expect(got.length).toBe(0)
    vi.advanceTimersByTime(100)
    expect(got).toEqual([{ p: { tick: 7 }, from: 'host' }])
    vi.useRealTimers()
  })
})
