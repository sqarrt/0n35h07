import { describe, it, expect } from 'vitest'
import { createLoopbackPair } from '../../src/net/LoopbackNet'
import { RoomSession } from '../../src/net/RoomSession'
import type { RoomView } from '../../src/net/RoomSession'
import type { PlayerProfile } from '../../src/settings'
import { OPPONENT_ID, HOST_ID } from '../../src/constants'

const GUEST: PlayerProfile = { name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome' }

const HOST: PlayerProfile = { name: 'Хост', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome' }

/** Поднимает хост+клиент на loopback (доставка синхронная → хендшейк завершается сразу). */
function handshake(clientProfile: PlayerProfile) {
  const [hostNet, clientNet] = createLoopbackPair('H', 'C')
  const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
  let hostView: RoomView | undefined
  host.onChange(v => { hostView = v })
  const client = new RoomSession(clientNet, 'client', 'AB12', clientProfile)
  let clientView: RoomView | undefined
  client.onChange(v => { clientView = v })
  return { host, client, hostView: hostView!, clientView: clientView! }
}

describe('RoomSession длительность матча', () => {
  it('хост задаёт длительность; клиент видит её и получает durationMs в onStart', () => {
    const [a, b] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'CODE', HOST)
    const client = new RoomSession(b, 'client', 'CODE', GUEST)
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

describe('RoomSession выбор карты', () => {
  it('дефолт — arena; хост меняет карту → клиент видит её и получает mapId в onStart', () => {
    const [a, b] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'CODE', HOST)
    const client = new RoomSession(b, 'client', 'CODE', GUEST)
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

describe('RoomSession — назначение цветов хостом', () => {
  it('клиент с тем же основным цветом, что у хоста, получает свой резервный', () => {
    const { hostView } = handshake({ name: 'Гость', primaryColor: '#4af', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo' })
    const clientEntry = hostView.roster.find(r => r.id === 1)!
    expect(clientEntry.color).toBe('#4fa')   // основной #4af занят хостом → резервный
    expect(clientEntry.name).toBe('Гость')
  })

  it('клиент со свободным основным цветом получает именно его', () => {
    const { hostView } = handshake({ name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo' })
    expect(hostView.roster.find(r => r.id === 1)!.color).toBe('#fd4')
  })

  it('клиент получает свой id и общий ростер (ASSIGN дошёл)', () => {
    const { clientView } = handshake({ name: 'Гость', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo' })
    expect(clientView.connected).toBe(true)
    expect(clientView.localPlayerId).toBe(1)
    expect(clientView.roster.map(r => r.id).sort()).toEqual([0, 1])
  })
})

describe('RoomSession — слот соперника (строго 1v1)', () => {
  /** host-сессия с подписанным view (для чтения текущего ростера/canStart). */
  function hostWithView() {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view!: RoomView
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
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view!: RoomView
    host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.roster.find(r => r.id === OPPONENT_ID)!.kind).toBe('bot')

    new RoomSession(clientNet, 'client', 'AB12', GUEST)   // HELLO синхронно вытесняет бота
    expect(view.roster.find(r => r.id === OPPONENT_ID)!.kind).toBe('human')
    expect(view.canStart).toBe(true)

    hostNet.triggerLeave()                                 // клиент ушёл
    expect(view.roster.find(r => r.id === OPPONENT_ID)).toBeUndefined()
    expect(view.canStart).toBe(false)
  })
})

describe('RoomSession — windupStyle в ростере', () => {
  it('windupStyle хоста и клиента едут в ростер (hello → assign)', () => {
    const { hostView, clientView } = handshake({ ...GUEST, windupStyle: 'singularity' })
    // стиль хоста берётся из его профиля (HOST.windupStyle === 'classic')
    expect(hostView.roster.find(r => r.id === 0)!.windupStyle).toBe('classic')
    // стиль клиента берётся из hello-сообщения
    expect(hostView.roster.find(r => r.id === 1)!.windupStyle).toBe('singularity')
    expect(clientView.roster.find(r => r.id === 1)!.windupStyle).toBe('singularity')
    expect(clientView.roster.find(r => r.id === 0)!.windupStyle).toBe('classic')   // стиль хоста доехал клиенту в ASSIGN
  })
})

describe('RoomSession — respawnStyle в ростере', () => {
  it('respawnStyle хоста и клиента едут в ростер (hello → assign)', () => {
    const { hostView, clientView } = handshake({ ...GUEST, respawnStyle: 'chaos' })
    expect(hostView.roster.find(r => r.id === 0)!.respawnStyle).toBe('echo')      // стиль хоста из его профиля
    expect(hostView.roster.find(r => r.id === 1)!.respawnStyle).toBe('chaos')     // стиль клиента из hello
    expect(clientView.roster.find(r => r.id === 1)!.respawnStyle).toBe('chaos')
    expect(clientView.roster.find(r => r.id === 0)!.respawnStyle).toBe('echo')    // стиль хоста доехал в ASSIGN
  })
})

describe('RoomSession — скины рывка и щита в ростере', () => {
  it('dashStyle/shieldStyle хоста и клиента едут в ростер (hello → assign)', () => {
    const { hostView, clientView } = handshake({ ...GUEST, dashStyle: 'wave', shieldStyle: 'crystal' })
    expect(hostView.roster.find(r => r.id === 0)!.dashStyle).toBe('streak')       // скины хоста из его профиля
    expect(hostView.roster.find(r => r.id === 0)!.shieldStyle).toBe('dome')
    expect(hostView.roster.find(r => r.id === 1)!.dashStyle).toBe('wave')         // скины клиента из hello
    expect(hostView.roster.find(r => r.id === 1)!.shieldStyle).toBe('crystal')
    expect(clientView.roster.find(r => r.id === 1)!.dashStyle).toBe('wave')
    expect(clientView.roster.find(r => r.id === 0)!.shieldStyle).toBe('dome')     // скин хоста доехал в ASSIGN
  })
})

describe('RoomSession — готовность (гейт в лобби)', () => {
  it('бот авто-готов: addBot → ready содержит OPPONENT_ID', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST)
    let view = host.view()
    host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.ready).toContain(OPPONENT_ID)
    expect(view.ready).not.toContain(HOST_ID)
  })

  it('хост + бот: setLocalReady(true) хоста → оба готовы → start (onStart срабатывает)', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST)
    let started = 0
    host.onStart(ms => { started = ms })
    host.addBot('normal')
    expect(started).toBe(0)
    host.setLocalReady(true)
    expect(started).toBeGreaterThan(0)
  })

  it('человек-соперник: оба setLocalReady(true) → start; готовность видна обоим', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let hostView = host.view(); host.onChange(v => { hostView = v })
    let started = 0; host.onStart(() => { started++ })
    const client = new RoomSession(clientNet, 'client', 'AB12', GUEST)
    let clientView = client.view(); client.onChange(v => { clientView = v })

    client.setLocalReady(true)
    expect(hostView.ready).toContain(OPPONENT_ID)
    expect(clientView.ready).toContain(OPPONENT_ID)
    expect(started).toBe(0)
    host.setLocalReady(true)
    expect(started).toBe(1)
  })

  it('setLocalReady(false) снимает готовность; повторного старта нет (guard)', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST)
    let started = 0; host.onStart(() => { started++ })
    host.addBot('normal')
    host.setLocalReady(true)
    expect(started).toBe(1)
    host.setLocalReady(false)
    host.setLocalReady(true)
    expect(started).toBe(1)
  })

  it('человек вытесняет бота → готовность слота сбрасывается (человек не готов)', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view = host.view(); host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.ready).toContain(OPPONENT_ID)
    new RoomSession(clientNet, 'client', 'AB12', GUEST)
    expect(view.ready).not.toContain(OPPONENT_ID)
  })
})
