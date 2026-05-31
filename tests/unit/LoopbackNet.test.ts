import { describe, it, expect, vi } from 'vitest'
import { createLoopbackPair } from '../../src/net/LoopbackNet'

describe('LoopbackNet', () => {
  it('broadcast доходит до второго эндпоинта с from=отправитель', () => {
    const [host, client] = createLoopbackPair('host', 'client')
    const got = vi.fn()
    client.on('input', got)
    host.broadcast('input', { seq: 1 })
    expect(got).toHaveBeenCalledWith({ seq: 1 }, 'host')
  })

  it('on(tag) фильтрует по тегу', () => {
    const [host, client] = createLoopbackPair()
    const onInput = vi.fn()
    const onSnap = vi.fn()
    client.on('input', onInput)
    client.on('snapshot', onSnap)
    host.broadcast('snapshot', { ackSeq: 0, players: [] })
    expect(onSnap).toHaveBeenCalledOnce()
    expect(onInput).not.toHaveBeenCalled()
  })

  it('send доставляет только адресату', () => {
    const [host, client] = createLoopbackPair('host', 'client')
    const got = vi.fn()
    client.on('event', got)
    host.send('client', 'event', { t: 'kill' })
    expect(got).toHaveBeenCalledOnce()
    host.send('nobody', 'event', { t: 'kill' })
    expect(got).toHaveBeenCalledOnce()   // не вырос
  })

  it('onPeerJoin видит присутствующего пира; peers() возвращает его', () => {
    const [host] = createLoopbackPair('host', 'client')
    const join = vi.fn()
    host.onPeerJoin(join)
    expect(join).toHaveBeenCalledWith('client')
    expect(host.peers()).toEqual(['client'])
  })
})
