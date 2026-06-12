import { describe, it, expect } from 'vitest'
import { LoopbackDiscovery } from '../../src/net/discovery/LoopbackDiscovery'
import type { PoolListing } from '../../src/net/matchmaking'

const L = (code: string): PoolListing => ({ code, name: 'RX', color: '#4af', map: 'os_arena', durationMin: 5 })

describe('LoopbackDiscovery', () => {
  it('subscribe получает уже опубликованные листинги (снапшот)', () => {
    const d = new LoopbackDiscovery()
    d.publish('b', L('AAAA'))
    const got: string[] = []
    d.subscribe('b', l => got.push(l.code))
    expect(got).toEqual(['AAAA'])
  })
  it('subscribe получает последующие публикации', () => {
    const d = new LoopbackDiscovery()
    const got: string[] = []
    d.subscribe('b', l => got.push(l.code))
    d.publish('b', L('BBBB'))
    expect(got).toEqual(['BBBB'])
  })
  it('другая корзина не доходит', () => {
    const d = new LoopbackDiscovery()
    const got: string[] = []
    d.subscribe('b1', l => got.push(l.code))
    d.publish('b2', L('CCCC'))
    expect(got).toEqual([])
  })
  it('unsubscribe прекращает доставку', () => {
    const d = new LoopbackDiscovery()
    const got: string[] = []
    const off = d.subscribe('b', l => got.push(l.code))
    off()
    d.publish('b', L('DDDD'))
    expect(got).toEqual([])
  })
  it('withdraw убирает листинг из снапшота', () => {
    const d = new LoopbackDiscovery()
    d.publish('b', L('EEEE'))
    d.withdraw('b', 'EEEE')
    const got: string[] = []
    d.subscribe('b', l => got.push(l.code))
    expect(got).toEqual([])
  })
})
