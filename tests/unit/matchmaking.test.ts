import { describe, it, expect } from 'vitest'
import { listingMatches, resolveMatchParams, MatchmakingPool, bucketKey, bucketsForListing, bucketsForFilter } from '../../src/net/matchmaking'
import type { PoolListing } from '../../src/net/matchmaking'
import { LoopbackDiscovery } from '../../src/net/discovery/LoopbackDiscovery'

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

describe('MatchmakingPool · интеграция (Discovery)', () => {
  it('клиент находит совместимого хоста → onMatch с кодом', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX-580', color: '#4af', map: 'os_arena', durationMin: 5 })
    client.search({ map: 'os_arena', durationMin: 5 }, code => matched.push(code))
    expect(matched).toEqual(['WXYZ'])
  })

  it('несовместимая карта → не матчится', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX', color: '#4af', map: 'os_arena', durationMin: 5 })
    client.search({ map: 'os_india', durationMin: 5 }, code => matched.push(code))
    expect(matched).toEqual([])
  })

  it('хост с «any картой» найден клиентом любой конкретной карты (фан по корзинам)', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const matched: string[] = []
    host.advertise({ code: 'ANY1', name: 'RX', color: '#4af', map: 'any', durationMin: 5 })
    client.search({ map: 'os_pillars', durationMin: 5 }, code => matched.push(code))
    expect(matched).toEqual(['ANY1'])
  })

  it('reject(code) + повторный search пропускает отклонённый код', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    host.advertise({ code: 'AAAA', name: 'RX', color: '#4af', map: 'os_arena', durationMin: 5 })
    const got: string[] = []
    client.search({ map: 'os_arena', durationMin: 5 }, code => got.push(code))
    expect(got).toEqual(['AAAA'])     // нашёл
    client.reject('AAAA')             // коннект не удался → пропустить этот код
    client.search({ map: 'os_arena', durationMin: 5 }, code => got.push(code))
    expect(got).toEqual(['AAAA'])     // AAAA отклонён → второго матча нет (ждём другого хоста)
  })

  it('cancel() прекращает поиск', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const got: string[] = []
    client.search({ map: 'os_arena', durationMin: 5 }, code => got.push(code))
    client.cancel()
    host.advertise({ code: 'BBBB', name: 'RX', color: '#4af', map: 'os_arena', durationMin: 5 })
    expect(got).toEqual([])
  })
})

describe('matchmaking · корзины', () => {
  it('bucketKey стабилен и по конкретным значениям', () => {
    expect(bucketKey('os_arena', 5)).toBe('mm:os_arena:5')
  })
  it('конкретный листинг → одна корзина', () => {
    expect(bucketsForListing('os_arena', 5)).toEqual(['mm:os_arena:5'])
  })
  it('листинг с «any» по карте → фан во все карты (×1 время)', () => {
    expect(bucketsForListing('any', 5).sort()).toEqual(['mm:os_arena:5', 'mm:os_india:5', 'mm:os_pillars:5'].sort())
  })
  it('обе «any» → полный кросс (3×3 = 9 корзин)', () => {
    expect(bucketsForListing('any', 'any')).toHaveLength(9)
  })
  it('фильтр клиента симметричен листингу (concrete → 1, any → фан)', () => {
    expect(bucketsForFilter('os_india', 'any')).toEqual(['mm:os_india:3', 'mm:os_india:5', 'mm:os_india:10'])
  })
})
