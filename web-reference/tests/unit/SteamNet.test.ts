import { describe, it, expect } from 'vitest'
import { SteamNet, type SteamNetTransport } from '../../src/net/SteamNet'
import type { NetTag } from '../../src/net/protocol'

const SELF = '100'
const PEER = '200'

function make() {
  const sent: Array<[string, string]> = []
  const transport: SteamNetTransport = { send: (to, data) => sent.push([to, data]), leave: () => {} }
  return { sent, net: new SteamNet(SELF, transport) }
}

describe('SteamNet — peer tracking', () => {
  it('lobbyEntered seeds peers (excluding self); join/leave update + fire callbacks', () => {
    const { net } = make()
    const joined: string[] = [], left: string[] = []
    net.onPeerJoin(p => joined.push(p))
    net.onPeerLeave(p => left.push(p))

    net.handleEvent({ kind: 'lobbyEntered', lobbyId: 'L', self: SELF, members: [SELF, PEER] })
    expect(net.peers()).toEqual([PEER])

    expect(joined).toEqual([PEER])   // seeding from lobbyEntered fires join (app discovers who's there)

    net.handleEvent({ kind: 'peerJoin', steamId: '300' })
    expect(net.peers()).toEqual([PEER, '300'])
    expect(joined).toEqual([PEER, '300'])

    net.handleEvent({ kind: 'peerLeave', steamId: PEER })
    expect(net.peers()).toEqual(['300'])
    expect(left).toEqual([PEER])
  })

  it('ignores self in peerJoin / lobby members', () => {
    const { net } = make()
    net.handleEvent({ kind: 'peerJoin', steamId: SELF })
    expect(net.peers()).toEqual([])
  })
})

describe('SteamNet — message framing', () => {
  it('broadcast sends a {tag,data} envelope to every peer', () => {
    const { sent, net } = make()
    net.handleEvent({ kind: 'lobbyEntered', lobbyId: 'L', self: SELF, members: [SELF, PEER] })
    net.broadcast('snap' as NetTag, { x: 1 })
    expect(sent).toEqual([[PEER, JSON.stringify({ tag: 'snap', data: { x: 1 } })]])
  })

  it('send targets one peer', () => {
    const { sent, net } = make()
    net.send(PEER, 'evt' as NetTag, [1, 2])
    expect(sent).toEqual([[PEER, JSON.stringify({ tag: 'evt', data: [1, 2] })]])
  })

  it('incoming message dispatches to on(tag) handlers with (payload, from)', () => {
    const { net } = make()
    const got: Array<[unknown, string]> = []
    net.on('snap' as NetTag, (p, from) => got.push([p, from]))
    net.handleEvent({ kind: 'message', from: PEER, data: JSON.stringify({ tag: 'snap', data: { hp: 3 } }) })
    expect(got).toEqual([[{ hp: 3 }, PEER]])
  })

  it('drops our own echoed message and malformed payloads', () => {
    const { net } = make()
    let calls = 0
    net.on('snap' as NetTag, () => { calls++ })
    net.handleEvent({ kind: 'message', from: SELF, data: JSON.stringify({ tag: 'snap', data: 1 }) })  // own echo
    net.handleEvent({ kind: 'message', from: PEER, data: 'not json' })                                 // malformed
    expect(calls).toBe(0)
  })
})

describe('SteamNet — leave', () => {
  it('leave() calls transport.leave + unlisten and clears peers', () => {
    const sent: Array<[string, string]> = []
    let leftCalled = false, unlistened = false
    const net = new SteamNet(SELF, { send: (to, data) => sent.push([to, data]), leave: () => { leftCalled = true } })
    net.setUnlisten(() => { unlistened = true })
    net.handleEvent({ kind: 'lobbyEntered', lobbyId: 'L', self: SELF, members: [SELF, PEER] })
    net.leave()
    expect(leftCalled).toBe(true)
    expect(unlistened).toBe(true)
    expect(net.peers()).toEqual([])
  })
})
