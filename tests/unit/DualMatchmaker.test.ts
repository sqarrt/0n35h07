import { describe, it, expect } from 'vitest'
import { MatchmakingPool } from '../../src/net/matchmaking'
import type { PoolListing, PoolFilter } from '../../src/net/matchmaking'
import { LoopbackDiscovery } from '../../src/net/discovery/LoopbackDiscovery'
import { DualMatchmaker } from '../../src/net/DualMatchmaker'
import type { SearchRole } from '../../src/settings'

const FILTER: PoolFilter = { map: ['os_arena'], durationMin: [5] }
const NS = '0.5.0:browser'        // общий неймспейс пула для всех пиров теста
const listingOf = (code: string): Omit<PoolListing, 'dual'> => ({ code, name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5] })

function mk(disco: LoopbackDiscovery, mode: SearchRole, code: string) {
  const pool = new MatchmakingPool(disco, NS)
  const joined: string[] = []
  const dm = new DualMatchmaker({ pool, mode, code, listing: listingOf(code), filter: FILTER })
  dm.onJoin(c => joined.push(c))
  return { dm, joined }
}

describe('DualMatchmaker · разрыватель ничьей', () => {
  it('both vs both → клиентом становится больший код, меньший остаётся хостом', () => {
    const disco = new LoopbackDiscovery()
    const a = mk(disco, 'both', 'AAAA')   // меньший
    const b = mk(disco, 'both', 'BBBB')   // больший
    a.dm.start()
    b.dm.start()
    expect(b.joined).toEqual(['AAAA'])    // больший зашёл клиентом к меньшему
    expect(a.joined).toEqual([])          // меньший остаётся хостом
    expect(b.dm.resolved).toBe('client')
  })

  it('both vs чистый client → both остаётся хостом, client заходит к нему', () => {
    const disco = new LoopbackDiscovery()
    const both = mk(disco, 'both', 'BBBB')
    const client = mk(disco, 'client', 'CCCC')
    both.dm.start()        // публикует листинг (dual:true) + ищет
    client.dm.start()      // только ищет → видит both
    expect(client.joined).toEqual(['BBBB'])
    expect(both.joined).toEqual([])
  })

  it('защёлка: hostConnected() до резолва делает последующего кандидата no-op', () => {
    const disco = new LoopbackDiscovery()
    const both = mk(disco, 'both', 'MMMM')
    both.dm.start()
    both.dm.hostConnected()                       // к нам подключились
    const other = new MatchmakingPool(disco, NS)
    other.advertise({ ...listingOf('AAAA'), dual: true })   // даже выгодный кандидат
    expect(both.joined).toEqual([])               // уже committed=host
    expect(both.dm.resolved).toBe('host')
  })
})
