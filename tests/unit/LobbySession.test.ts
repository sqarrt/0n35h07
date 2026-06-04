import { describe, it, expect } from 'vitest'
import { createLoopbackPair } from '../../src/net/LoopbackNet'
import { LobbySession } from '../../src/net/LobbySession'
import type { LobbyView } from '../../src/net/LobbySession'
import type { PlayerProfile } from '../../src/settings'
import { OPPONENT_ID } from '../../src/constants'

const GUEST: PlayerProfile = { name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth' }

const HOST: PlayerProfile = { name: 'Хост', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp', ballModel: 'smooth' }

/** Поднимает хост+клиент на loopback (доставка синхронная → хендшейк завершается сразу). */
function handshake(clientProfile: PlayerProfile) {
  const [hostNet, clientNet] = createLoopbackPair('H', 'C')
  const host = new LobbySession(hostNet, 'host', 'AB12', HOST)
  let hostView: LobbyView | undefined
  host.onChange(v => { hostView = v })
  const client = new LobbySession(clientNet, 'client', 'AB12', clientProfile)
  let clientView: LobbyView | undefined
  client.onChange(v => { clientView = v })
  return { host, client, hostView: hostView!, clientView: clientView! }
}

describe('LobbySession длительность матча', () => {
  it('хост задаёт длительность; клиент видит её и получает durationMs в onStart', () => {
    const [a, b] = createLoopbackPair('H', 'C')
    const host = new LobbySession(a, 'host', 'CODE', HOST)
    const client = new LobbySession(b, 'client', 'CODE', GUEST)
    // После конструкторов клиент уже подключился (HELLO синхронно → ASSIGN)
    host.setDuration(10)
    let started = 0
    client.onStart(ms => { started = ms })
    let clientView = client.view()
    client.onChange(v => { clientView = v })
    host.start()   // client уже в слоте соперника после HELLO
    expect(clientView.durationMin).toBe(10)
    expect(started).toBe(600000)
  })
})

describe('LobbySession выбор карты', () => {
  it('дефолт — arena; хост меняет карту → клиент видит её и получает mapId в onStart', () => {
    const [a, b] = createLoopbackPair('H', 'C')
    const host = new LobbySession(a, 'host', 'CODE', HOST)
    const client = new LobbySession(b, 'client', 'CODE', GUEST)
    let clientView = client.view()
    client.onChange(v => { clientView = v })
    expect(clientView.mapId).toBe('os_arena')

    host.setMap('os_pillars')
    let startedMap = ''
    client.onStart((_ms, mapId) => { startedMap = mapId })
    host.start()
    expect(clientView.mapId).toBe('os_pillars')
    expect(startedMap).toBe('os_pillars')
  })
})

describe('LobbySession — назначение цветов хостом', () => {
  it('клиент с тем же основным цветом, что у хоста, получает свой резервный', () => {
    const { hostView } = handshake({ name: 'Гость', primaryColor: '#4af', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth' })
    const clientEntry = hostView.roster.find(r => r.id === 1)!
    expect(clientEntry.color).toBe('#4fa')   // основной #4af занят хостом → резервный
    expect(clientEntry.name).toBe('Гость')
  })

  it('клиент со свободным основным цветом получает именно его', () => {
    const { hostView } = handshake({ name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth' })
    expect(hostView.roster.find(r => r.id === 1)!.color).toBe('#fd4')
  })

  it('клиент получает свой id и общий ростер (ASSIGN дошёл)', () => {
    const { clientView } = handshake({ name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth' })
    expect(clientView.connected).toBe(true)
    expect(clientView.localPlayerId).toBe(1)
    expect(clientView.roster.map(r => r.id).sort()).toEqual([0, 1])
  })
})

describe('LobbySession — слот соперника (строго 1v1)', () => {
  /** host-сессия с подписанным view (для чтения текущего ростера/canStart). */
  function hostWithView() {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new LobbySession(hostNet, 'host', 'AB12', HOST)
    let view!: LobbyView
    host.onChange(v => { view = v })
    return { host, hostNet, clientNet, get: () => view }
  }

  it('пустой слот → canStart=false; addBot заполняет слот id=OPPONENT_ID → canStart=true', () => {
    const { host, get } = hostWithView()
    expect(get().canStart).toBe(false)
    host.addBot('normal')
    const opp = get().roster.find(r => r.id === OPPONENT_ID)!
    expect(opp.kind).toBe('bot')
    expect(get().canStart).toBe(true)
  })

  it('повторный addBot — no-op (соперник один)', () => {
    const { host, get } = hostWithView()
    host.addBot('normal')
    host.addBot('passive')
    expect(get().roster.filter(r => r.id === OPPONENT_ID)).toHaveLength(1)
    expect(get().roster.find(r => r.id === OPPONENT_ID)!.difficulty).toBe('normal')
  })

  it('removeBot очищает слот → canStart=false', () => {
    const { host, get } = hostWithView()
    host.addBot('normal')
    host.removeBot()
    expect(get().roster.find(r => r.id === OPPONENT_ID)).toBeUndefined()
    expect(get().canStart).toBe(false)
  })

  it('зашедший человек вытесняет бота; уход человека освобождает слот', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new LobbySession(hostNet, 'host', 'AB12', HOST)
    let view!: LobbyView
    host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.roster.find(r => r.id === OPPONENT_ID)!.kind).toBe('bot')

    new LobbySession(clientNet, 'client', 'AB12', GUEST)   // HELLO синхронно вытесняет бота
    expect(view.roster.find(r => r.id === OPPONENT_ID)!.kind).toBe('human')
    expect(view.canStart).toBe(true)

    hostNet.triggerLeave()                                 // клиент ушёл
    expect(view.roster.find(r => r.id === OPPONENT_ID)).toBeUndefined()
    expect(view.canStart).toBe(false)
  })
})
