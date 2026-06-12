import { describe, it, expect } from 'vitest'
import { listingMatches, resolveMatchParams } from '../../src/net/matchmaking'
import type { PoolListing } from '../../src/net/matchmaking'

const listing = (over: Partial<PoolListing> = {}): PoolListing => ({
  code: 'AAAA', name: 'RX-580', color: '#4af', map: 'os_arena', durationMin: 5, ...over,
})

describe('matchmaking · совместимость', () => {
  it('конкретные равны → совместимо', () => {
    expect(listingMatches({ map: 'os_arena', durationMin: 5 }, listing())).toBe(true)
  })
  it('разная карта → несовместимо', () => {
    expect(listingMatches({ map: 'os_india', durationMin: 5 }, listing())).toBe(false)
  })
  it('разное время → несовместимо', () => {
    expect(listingMatches({ map: 'os_arena', durationMin: 10 }, listing())).toBe(false)
  })
  it('«любая» у клиента совместима с любым хостом', () => {
    expect(listingMatches({ map: 'any', durationMin: 'any' }, listing({ map: 'os_pillars', durationMin: 3 }))).toBe(true)
  })
  it('«любая» у хоста совместима с любым клиентом', () => {
    expect(listingMatches({ map: 'os_pillars', durationMin: 3 }, listing({ map: 'any', durationMin: 'any' }))).toBe(true)
  })
})

describe('matchmaking · резолв параметров', () => {
  const rnd = { map: () => 'os_india' as const, dur: () => 10 }
  it('конкретное у хоста бьёт «любая» у клиента', () => {
    const r = resolveMatchParams({ map: 'os_arena', durationMin: 5 }, { map: 'any', durationMin: 'any' }, rnd.map, rnd.dur)
    expect(r).toEqual({ mapId: 'os_arena', durationMin: 5 })
  })
  it('«любая» у хоста → берётся конкретное клиента', () => {
    const r = resolveMatchParams({ map: 'any', durationMin: 'any' }, { map: 'os_pillars', durationMin: 3 }, rnd.map, rnd.dur)
    expect(r).toEqual({ mapId: 'os_pillars', durationMin: 3 })
  })
  it('обе «любая» → случайное (из инъектированного rng)', () => {
    const r = resolveMatchParams({ map: 'any', durationMin: 'any' }, { map: 'any', durationMin: 'any' }, rnd.map, rnd.dur)
    expect(r).toEqual({ mapId: 'os_india', durationMin: 10 })
  })
})
