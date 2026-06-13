import { describe, it, expect } from 'vitest'
import { listingMatches, resolveMatchParams, MatchmakingPool, bucketKey, bucketsForListing, bucketsForFilter } from '../../src/net/matchmaking'
import type { PoolListing } from '../../src/net/matchmaking'
import { LoopbackDiscovery } from '../../src/net/discovery/LoopbackDiscovery'

const listing = (over: Partial<PoolListing> = {}): PoolListing => ({
  code: 'AAAA', name: 'RX-580', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false, ...over,
})

describe('matchmaking · совместимость (пересечение наборов)', () => {
  it('пересекаются карты и время → совместимо', () => {
    expect(listingMatches({ map: ['os_arena'], durationMin: [5] }, listing())).toBe(true)
  })
  it('карты не пересекаются → несовместимо', () => {
    expect(listingMatches({ map: ['os_india'], durationMin: [5] }, listing())).toBe(false)
  })
  it('время не пересекается → несовместимо', () => {
    expect(listingMatches({ map: ['os_arena'], durationMin: [10] }, listing())).toBe(false)
  })
  it('частичное пересечение карт → совместимо', () => {
    expect(listingMatches({ map: ['os_india', 'os_arena'], durationMin: [5] }, listing({ map: ['os_arena', 'os_pillars'] }))).toBe(true)
  })
})

describe('matchmaking · резолв (случайный из пересечения)', () => {
  const pickFirst = <T>(a: T[]): T => a[0]
  it('карта/время — из пересечения наборов', () => {
    const r = resolveMatchParams({ map: ['os_arena', 'os_india'], durationMin: [5, 10] }, { map: ['os_india', 'os_pillars'], durationMin: [10] }, pickFirst, pickFirst)
    expect(r).toEqual({ mapId: 'os_india', durationMin: 10 })
  })
  it('единственный общий вариант резолвится в него', () => {
    const r = resolveMatchParams({ map: ['os_arena'], durationMin: [3] }, { map: ['os_arena'], durationMin: [3] }, pickFirst, pickFirst)
    expect(r).toEqual({ mapId: 'os_arena', durationMin: 3 })
  })
})

describe('matchmaking · корзины', () => {
  it('bucketKey стабилен и по конкретным значениям', () => {
    expect(bucketKey('os_arena', 5)).toBe('mm:os_arena:5')
  })
  it('один выбор → одна корзина', () => {
    expect(bucketsForListing(['os_arena'], [5])).toEqual(['mm:os_arena:5'])
  })
  it('две карты × одно время → 2 корзины', () => {
    expect(bucketsForListing(['os_arena', 'os_india'], [5]).sort()).toEqual(['mm:os_arena:5', 'mm:os_india:5'].sort())
  })
  it('все карты × все длительности → полный кросс (3×3=9)', () => {
    expect(bucketsForListing(['os_arena', 'os_india', 'os_pillars'], [3, 5, 10])).toHaveLength(9)
  })
  it('фильтр клиента симметричен листингу', () => {
    expect(bucketsForFilter(['os_india'], [3, 5, 10])).toEqual(['mm:os_india:3', 'mm:os_india:5', 'mm:os_india:10'])
  })
})

describe('MatchmakingPool · интеграция (Discovery)', () => {
  it('клиент находит совместимого хоста → onMatch с кодом', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX-580', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual(['WXYZ'])
  })

  it('несовместимая карта → не матчится', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const matched: string[] = []
    host.advertise({ code: 'WXYZ', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_india'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual([])
  })

  it('пересечение наборов: хост [arena], клиент [arena,india] → найден (общая корзина)', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const matched: string[] = []
    host.advertise({ code: 'XSET', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    client.search({ map: ['os_arena', 'os_india'], durationMin: [5] }, l => { matched.push(l.code); return true })
    expect(matched).toEqual(['XSET'])
  })

  it('reject(code) + повторный search пропускает отклонённый код', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    host.advertise({ code: 'AAAA', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    const got: string[] = []
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { got.push(l.code); return true })
    expect(got).toEqual(['AAAA'])
    client.reject('AAAA')
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { got.push(l.code); return true })
    expect(got).toEqual(['AAAA'])
  })

  it('cancel() прекращает поиск', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const got: string[] = []
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { got.push(l.code); return true })
    client.cancel()
    host.advertise({ code: 'BBBB', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: false })
    expect(got).toEqual([])
  })

  it('search многоразовый: onMatch→false продолжает слушать, →true останавливает', () => {
    const disco = new LoopbackDiscovery()
    const host = new MatchmakingPool(disco)
    const client = new MatchmakingPool(disco)
    const seen: string[] = []
    client.search({ map: ['os_arena'], durationMin: [5] }, l => { seen.push(l.code); return false })
    host.advertise({ code: 'AAAA', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: true })
    // не сконсьюмлено → подписка жива; новый листинг той же корзины снова прилетит
    const host2 = new MatchmakingPool(disco)
    host2.advertise({ code: 'BBBB', name: 'RX', color: '#4af', map: ['os_arena'], durationMin: [5], dual: true })
    expect(seen).toEqual(['AAAA', 'BBBB'])
  })
})
