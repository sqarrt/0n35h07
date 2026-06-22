import { describe, it, expect } from 'vitest'
import { listingMatches, resolveMatchParams, MatchmakingPool, bucketKey, bucketsForListing, bucketsForFilter } from '../../src/net/matchmaking'
import type { PoolListing } from '../../src/net/matchmaking'
import { LoopbackDiscovery } from '../../src/net/discovery/LoopbackDiscovery'

const listing = (over: Partial<PoolListing> = {}): PoolListing => ({
  code: 'AAAA', name: 'RX-580', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false, ...over,
})

const NS = '0.5.0:browser'        // pool namespace (version+platform) — shared by compatible peers

describe('matchmaking · compatibility (set intersection)', () => {
  it('maps and durations intersect → compatible', () => {
    expect(listingMatches({ map: ['os_arena'], durationMin: [5] }, listing())).toBe(true)
  })
  it('maps do not intersect → incompatible', () => {
    expect(listingMatches({ map: ['os_india'], durationMin: [5] }, listing())).toBe(false)
  })
  it('durations do not intersect → incompatible', () => {
    expect(listingMatches({ map: ['os_arena'], durationMin: [10] }, listing())).toBe(false)
  })
  it('partial map intersection → compatible', () => {
    expect(listingMatches({ map: ['os_india', 'os_arena'], durationMin: [5] }, listing({ map: ['os_arena', 'os_pillars'] }))).toBe(true)
  })
})

describe('matchmaking · resolve (random from the intersection)', () => {
  const pickFirst = <T>(a: T[]): T => a[0]
  it('map/duration come from the set intersection', () => {
    const r = resolveMatchParams({ map: ['os_arena', 'os_india'], durationMin: [5, 10] }, { map: ['os_india', 'os_pillars'], durationMin: [10] }, pickFirst, pickFirst)
    expect(r).toEqual({ mapId: 'os_india', durationMin: 10 })
  })
  it('the single common option resolves to itself', () => {
    const r = resolveMatchParams({ map: ['os_arena'], durationMin: [3] }, { map: ['os_arena'], durationMin: [3] }, pickFirst, pickFirst)
    expect(r).toEqual({ mapId: 'os_arena', durationMin: 3 })
  })
})

describe('matchmaking · buckets', () => {
  it('bucketKey includes the namespace (version+platform), map and duration', () => {
    expect(bucketKey('os_arena', 5, NS)).toBe('mm:0.5.0:browser:os_arena:5')
  })
  it('different namespaces → different keys (version/platform isolation)', () => {
    expect(bucketKey('os_arena', 5, '0.5.0:browser')).not.toBe(bucketKey('os_arena', 5, '0.5.0:desktop'))
    expect(bucketKey('os_arena', 5, '0.5.0:browser')).not.toBe(bucketKey('os_arena', 5, '0.5.1:browser'))
  })
  it('a single choice → a single bucket', () => {
    expect(bucketsForListing(['os_arena'], [5], NS)).toEqual([`mm:${NS}:os_arena:5`])
  })
  it('two maps × one duration → 2 buckets', () => {
    expect(bucketsForListing(['os_arena', 'os_india'], [5], NS).sort()).toEqual([`mm:${NS}:os_arena:5`, `mm:${NS}:os_india:5`].sort())
  })
  it('all maps × all durations → full cross (3×3=9)', () => {
    expect(bucketsForListing(['os_arena', 'os_india', 'os_pillars'], [3, 5, 10], NS)).toHaveLength(9)
  })
  it('the client filter is symmetric to the listing', () => {
    expect(bucketsForFilter(['os_india'], [3, 5, 10], NS)).toEqual([`mm:${NS}:os_india:3`, `mm:${NS}:os_india:5`, `mm:${NS}:os_india:10`])
  })
})

describe('MatchmakingPool · integration (Discovery)', () => {
  it('client finds a compatible host → onMatch with the code', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, NS)
    const client = new MatchmakingPool(disco, NS)
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX-580', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual(['WXYZ'])
  })

  it('different version → no match (pool isolation by namespace)', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, '0.5.0:browser')
    const client = new MatchmakingPool(disco, '0.5.1:browser')   // different patch
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual([])
  })

  it('different platform → no match (desktop ≠ browser)', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, '0.5.0:desktop')
    const client = new MatchmakingPool(disco, '0.5.0:browser')
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual([])
  })

  it('incompatible map → no match', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, NS)
    const client = new MatchmakingPool(disco, NS)
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_india'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual([])
  })

  it('set intersection: host [arena], client [arena,india] → found (shared bucket)', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, NS)
    const client = new MatchmakingPool(disco, NS)
    const matched: string[] = []
    host.advertise({ code: 'XSET', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_arena', 'os_india'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual(['XSET'])
  })

  it('reject(code) + repeated search skips the rejected code', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, NS)
    const client = new MatchmakingPool(disco, NS)
    host.advertise({ code: 'AAAA', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    const got: string[] = []
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { got.push(l.code); return true })
    expect(got).toEqual(['AAAA'])
    client.reject('AAAA')
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { got.push(l.code); return true })
    expect(got).toEqual(['AAAA'])
  })

  it('cancel() stops the search', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, NS)
    const client = new MatchmakingPool(disco, NS)
    const got: string[] = []
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { got.push(l.code); return true })
    client.cancel()
    host.advertise({ code: 'BBBB', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    expect(got).toEqual([])
  })

  it('search is reusable: onMatch→false keeps listening, →true stops', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco, NS)
    const client = new MatchmakingPool(disco, NS)
    const seen: string[] = []
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { seen.push(l.code); return false })
    host.advertise({ code: 'AAAA', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: true })
    // not consumed → subscription stays alive; a new listing in the same bucket arrives again
    const host2 = new MatchmakingPool(disco, NS)
    host2.advertise({ code: 'BBBB', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: true })
    expect(seen).toEqual(['AAAA', 'BBBB'])
  })
})
