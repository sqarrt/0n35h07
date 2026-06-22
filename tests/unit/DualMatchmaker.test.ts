import { describe, it, expect } from 'vitest'
import { MatchmakingPool } from '../../src/net/matchmaking'
import type { PoolListing, PoolFilter } from '../../src/net/matchmaking'
import { LoopbackDiscovery } from '../../src/net/discovery/LoopbackDiscovery'
import { DualMatchmaker } from '../../src/net/DualMatchmaker'
import type { SearchRole } from '../../src/settings'

const FILTER: PoolFilter = { map: ['os_arena'], durationMin: [5] }
const NS = '0.5.0:browser'        // shared pool namespace for all peers in the test
const listingOf = (code: string): Omit<PoolListing, 'dual'> => ({ code, name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5] })

function mk(disco: LoopbackDiscovery, mode: SearchRole, code: string) {
  const pool = new MatchmakingPool(disco, NS)
  const joined: string[] = []
  const dm = new DualMatchmaker({ pool, mode, code, listing: listingOf(code), filter: FILTER })
  dm.onJoin(c => joined.push(c))
  return { dm, joined }
}

describe('DualMatchmaker · tie-breaker', () => {
  it('both vs both → higher code becomes client, lower stays host', () => {
    const disco = new LoopbackDiscovery()
    const a = mk(disco, 'both', 'AAAA')   // lower
    const b = mk(disco, 'both', 'BBBB')   // higher
    a.dm.start()
    b.dm.start()
    expect(b.joined).toEqual(['AAAA'])    // higher joined the lower one as client
    expect(a.joined).toEqual([])          // lower stays host
    expect(b.dm.resolved).toBe('client')
  })

  it('both vs pure client → both stays host, client joins it', () => {
    const disco = new LoopbackDiscovery()
    const both = mk(disco, 'both', 'BBBB')
    const client = mk(disco, 'client', 'CCCC')
    both.dm.start()        // publishes listing (dual:true) + searches
    client.dm.start()      // only searches → sees both
    expect(client.joined).toEqual(['BBBB'])
    expect(both.joined).toEqual([])
  })

  it('latch: hostConnected() before resolve makes a later candidate a no-op', () => {
    const disco = new LoopbackDiscovery()
    const both = mk(disco, 'both', 'MMMM')
    both.dm.start()
    both.dm.hostConnected()                       // someone connected to us
    const other = new MatchmakingPool(disco, NS)
    other.advertise({ ...listingOf('AAAA'), dual: true })   // even a favorable candidate
    expect(both.joined).toEqual([])               // already committed=host
    expect(both.dm.resolved).toBe('host')
  })
})
