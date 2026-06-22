import { describe, it, expect, vi } from 'vitest'
import { createLoopbackPair } from '../../src/net/LoopbackNet'
import { RoomSession } from '../../src/net/RoomSession'
import type { RoomView } from '../../src/net/RoomSession'
import type { PlayerProfile } from '../../src/settings'
import { OPPONENT_ID, HOST_ID } from '../../src/constants'
import { MAP_IDS } from '../../src/game/maps'
import { botAppearance } from '../../src/game/botAppearance'

const GUEST: PlayerProfile = { name: 'Guest', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome' }

const HOST: PlayerProfile = { name: 'Host', primaryColor: '#4af', reserveColor: '#fa4', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome' }

/** Brings up host+client over loopback (delivery is synchronous → handshake completes immediately). */
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

describe('RoomSession match duration', () => {
  it('host sets duration; client sees it and receives durationMs in onStart', () => {
    const [a, b] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'CODE', HOST)
    const client = new RoomSession(b, 'client', 'CODE', GUEST)
    // After the constructors the client is already connected (HELLO synchronously → ASSIGN)
    host.setDuration([10])
    let started = 0
    client.onStart(ms => { started = ms })
    let clientView = client.view()
    client.onChange(v => { clientView = v })
    host.start()   // client is already in the opponent slot after HELLO
    expect(clientView.durationMin).toBe(10)
    expect(started).toBe(600000)
  })
})

describe('RoomSession map selection', () => {
  it('default is arena; host changes map → client sees it and receives mapId in onStart', () => {
    const [a, b] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'CODE', HOST)
    const client = new RoomSession(b, 'client', 'CODE', GUEST)
    let clientView = client.view()
    client.onChange(v => { clientView = v })
    expect(clientView.mapId).toBe('os_arena')

    host.setMap(['os_pillars'])
    let startedMap = ''
    client.onStart((_ms, mapId) => { startedMap = mapId })
    host.start()
    expect(clientView.mapId).toBe('os_pillars')
    expect(startedMap).toBe('os_pillars')
  })
})

describe('RoomSession — color assignment by host', () => {
  it('client with the same primary color as the host gets its reserve one', () => {
    const { hostView } = handshake({ name: 'Guest', primaryColor: '#4af', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo' })
    const clientEntry = hostView.roster.find(r => r.id === 1)!
    expect(clientEntry.color).toBe('#4fa')   // primary #4af taken by host → reserve
    expect(clientEntry.name).toBe('Guest')
  })

  it('client with a free primary color gets exactly it', () => {
    const { hostView } = handshake({ name: 'Guest', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo' })
    expect(hostView.roster.find(r => r.id === 1)!.color).toBe('#fd4')
  })

  it('client receives its id and the shared roster (ASSIGN arrived)', () => {
    const { clientView } = handshake({ name: 'Guest', primaryColor: '#fd4', reserveColor: '#4fa', defaultView: 'fp', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo' })
    expect(clientView.connected).toBe(true)
    expect(clientView.localPlayerId).toBe(1)
    expect(clientView.roster.map(r => r.id).sort()).toEqual([0, 1])
  })
})

describe('RoomSession — opponent slot (strictly 1v1)', () => {
  /** host session with a subscribed view (to read the current roster/canStart). */
  function hostWithView() {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view!: RoomView
    host.onChange(v => { view = v })
    return { host, hostNet, clientNet, get: () => view }
  }

  it('empty slot → canStart=false; addBot fills slot id=OPPONENT_ID → canStart=true', () => {
    const { host, get } = hostWithView()
    expect(get().canStart).toBe(false)
    host.addBot('normal')
    const opp = get().roster.find(r => r.id === OPPONENT_ID)!
    expect(opp.kind).toBe('bot')
    expect(get().canStart).toBe(true)
  })

  it('addBot assigns botAppearance(name) cosmetics and a color without collision with the host', () => {
    const { host, get } = hostWithView()
    host.addBot('normal')
    const bot = get().roster.find(r => r.id === OPPONENT_ID)!
    const want = botAppearance(bot.name)
    expect(bot.kind).toBe('bot')
    expect(bot.ballModel).toBe(want.ballModel)
    expect(bot.windupStyle).toBe(want.windupStyle)
    expect(bot.respawnStyle).toBe(want.respawnStyle)
    expect(bot.dashStyle).toBe(want.dashStyle)
    expect(bot.shieldStyle).toBe(want.shieldStyle)
    expect(bot.color).not.toBe(HOST.primaryColor)   // no collision with the host's color
  })

  it('repeated addBot — no-op (single opponent)', () => {
    const { host, get } = hostWithView()
    host.addBot('normal')
    host.addBot('passive')
    expect(get().roster.filter(r => r.id === OPPONENT_ID)).toHaveLength(1)
    expect(get().roster.find(r => r.id === OPPONENT_ID)!.difficulty).toBe('normal')
  })

  it('removeBot clears the slot → canStart=false', () => {
    const { host, get } = hostWithView()
    host.addBot('normal')
    host.removeBot()
    expect(get().roster.find(r => r.id === OPPONENT_ID)).toBeUndefined()
    expect(get().canStart).toBe(false)
  })

  it('an arriving human evicts the bot; the human leaving frees the slot', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view!: RoomView
    host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.roster.find(r => r.id === OPPONENT_ID)!.kind).toBe('bot')

    new RoomSession(clientNet, 'client', 'AB12', GUEST)   // HELLO synchronously evicts the bot
    expect(view.roster.find(r => r.id === OPPONENT_ID)!.kind).toBe('human')
    expect(view.canStart).toBe(true)

    hostNet.triggerLeave()                                 // client left
    expect(view.roster.find(r => r.id === OPPONENT_ID)).toBeUndefined()
    expect(view.canStart).toBe(false)
  })
})

describe('RoomSession — bot name', () => {
  function hostWithView() {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view!: RoomView
    host.onChange(v => { view = v })
    return { host, clientNet, get: () => view }
  }
  const oppOf = (v: RoomView) => v.roster.find(r => r.id === OPPONENT_ID)!

  it('addBot with an explicit name → the bot carries that name, appearance is derived from it', () => {
    const { host, get } = hostWithView()
    host.addBot('normal', 'GLITCH')
    const bot = oppOf(get())
    expect(bot.name).toBe('GLITCH')
    const want = botAppearance('GLITCH')
    expect(bot.ballModel).toBe(want.ballModel)
    expect(bot.dashStyle).toBe(want.dashStyle)
  })

  it('addBot with an empty name → substitutes a generated (non-empty) one', () => {
    const { host, get } = hostWithView()
    host.addBot('normal', '   ')
    expect(oppOf(get()).name.trim().length).toBeGreaterThan(0)
  })

  it('setBotName renames the bot live: name and appearance update', () => {
    const { host, get } = hostWithView()
    host.addBot('normal', 'ALPHA')
    expect(oppOf(get()).name).toBe('ALPHA')
    host.setBotName('OMEGA')
    const bot = oppOf(get())
    expect(bot.name).toBe('OMEGA')
    expect(bot.difficulty).toBe('normal')          // difficulty preserved
    expect(bot.ballModel).toBe(botAppearance('OMEGA').ballModel)
  })

  it('setBotName with an empty string → bot unchanged', () => {
    const { host, get } = hostWithView()
    host.addBot('normal', 'KEEP')
    host.setBotName('   ')
    expect(oppOf(get()).name).toBe('KEEP')
  })

  it('setBotName with no bot in the slot → no-op', () => {
    const { host, get } = hostWithView()
    host.setBotName('NOBODY')
    expect(get().roster.find(r => r.id === OPPONENT_ID)).toBeUndefined()
  })
})

describe('RoomSession — windupStyle in the roster', () => {
  it('host and client windupStyle travel into the roster (hello → assign)', () => {
    const { hostView, clientView } = handshake({ ...GUEST, windupStyle: 'singularity' })
    // host style is taken from its profile (HOST.windupStyle === 'classic')
    expect(hostView.roster.find(r => r.id === 0)!.windupStyle).toBe('classic')
    // client style is taken from the hello message
    expect(hostView.roster.find(r => r.id === 1)!.windupStyle).toBe('singularity')
    expect(clientView.roster.find(r => r.id === 1)!.windupStyle).toBe('singularity')
    expect(clientView.roster.find(r => r.id === 0)!.windupStyle).toBe('classic')   // host style reached the client in ASSIGN
  })
})

describe('RoomSession — respawnStyle in the roster', () => {
  it('host and client respawnStyle travel into the roster (hello → assign)', () => {
    const { hostView, clientView } = handshake({ ...GUEST, respawnStyle: 'chaos' })
    expect(hostView.roster.find(r => r.id === 0)!.respawnStyle).toBe('echo')      // host style from its profile
    expect(hostView.roster.find(r => r.id === 1)!.respawnStyle).toBe('chaos')     // client style from hello
    expect(clientView.roster.find(r => r.id === 1)!.respawnStyle).toBe('chaos')
    expect(clientView.roster.find(r => r.id === 0)!.respawnStyle).toBe('echo')    // host style reached client in ASSIGN
  })
})

describe('RoomSession — dash and shield skins in the roster', () => {
  it('host and client dashStyle/shieldStyle travel into the roster (hello → assign)', () => {
    const { hostView, clientView } = handshake({ ...GUEST, dashStyle: 'wave', shieldStyle: 'crystal' })
    expect(hostView.roster.find(r => r.id === 0)!.dashStyle).toBe('streak')       // host skins from its profile
    expect(hostView.roster.find(r => r.id === 0)!.shieldStyle).toBe('dome')
    expect(hostView.roster.find(r => r.id === 1)!.dashStyle).toBe('wave')         // client skins from hello
    expect(hostView.roster.find(r => r.id === 1)!.shieldStyle).toBe('crystal')
    expect(clientView.roster.find(r => r.id === 1)!.dashStyle).toBe('wave')
    expect(clientView.roster.find(r => r.id === 0)!.shieldStyle).toBe('dome')     // host skin reached client in ASSIGN
  })
})

describe('RoomSession — readiness (lobby gate)', () => {
  it('bot is auto-ready: addBot → ready contains OPPONENT_ID', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST)
    let view = host.view()
    host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.ready).toContain(OPPONENT_ID)
    expect(view.ready).not.toContain(HOST_ID)
  })

  it('host + bot: host setLocalReady(true) → both ready → start (onStart fires)', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST)
    let started = 0
    host.onStart(ms => { started = ms })
    host.addBot('normal')
    expect(started).toBe(0)
    host.setLocalReady(true)
    expect(started).toBeGreaterThan(0)
  })

  it('human opponent: both setLocalReady(true) → start; readiness visible to both', () => {
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

  it('setLocalReady(false) clears readiness; no repeated start (guard)', () => {
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

  it('human evicts bot → slot readiness resets (human not ready)', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    let view = host.view(); host.onChange(v => { view = v })
    host.addBot('normal')
    expect(view.ready).toContain(OPPONENT_ID)
    new RoomSession(clientNet, 'client', 'AB12', GUEST)
    expect(view.ready).not.toContain(OPPONENT_ID)
  })
})

describe('RoomSession — map/time matching (sets + resolve)', () => {
  it('host concrete + bot → matchMap = host map; mapSel = [it]', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST, { map: ['os_pillars'], durationMin: [5] })
    let view = host.view(); host.onChange(v => { view = v })
    let startedMap = ''; host.onStart((_ms, mapId) => { startedMap = mapId })
    host.addBot('normal')
    host.setLocalReady(true)
    expect(view.mapId).toBe('os_pillars')
    expect(view.mapSel).toEqual(['os_pillars'])
    expect(startedMap).toBe('os_pillars')
  })

  it('host with all maps + bot → matchMap is a random valid map', () => {
    const [a] = createLoopbackPair('H', 'C')
    const host = new RoomSession(a, 'host', 'AB12', HOST, { map: MAP_IDS, durationMin: [5] })
    let view = host.view(); host.onChange(v => { view = v })
    host.addBot('normal')
    expect(MAP_IDS).toContain(view.mapId)
    expect(view.durationMin).toBe(5)
  })

  it('host with all + client wants [os_india]/[10] → resolve = os_india/10 for both', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST, { map: MAP_IDS, durationMin: [3, 5, 10] })
    let hostView = host.view(); host.onChange(v => { hostView = v })
    const client = new RoomSession(clientNet, 'client', 'AB12', GUEST, { map: ['os_india'], durationMin: [10] })
    let clientView = client.view(); client.onChange(v => { clientView = v })
    expect(hostView.mapId).toBe('os_india')
    expect(hostView.durationMin).toBe(10)
    expect(clientView.mapId).toBe('os_india')
    expect(clientView.durationMin).toBe(10)
  })

  it('client sees its own set before connecting (mapSel/durationSel)', () => {
    const [, clientNet] = createLoopbackPair('H', 'C')
    const client = new RoomSession(clientNet, 'client', 'AB12', GUEST, { map: ['os_arena', 'os_india'], durationMin: [3] })
    expect(client.view().mapSel).toEqual(['os_arena', 'os_india'])
    expect(client.view().durationSel).toEqual([3])
  })
})

describe('RoomSession — disconnect in lobby (client)', () => {
  it('host left before match start → client gets onClosed (rollback to search)', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    new RoomSession(hostNet, 'host', 'AB12', HOST)
    const client = new RoomSession(clientNet, 'client', 'AB12', GUEST)
    let closed = false
    client.onClosed(() => { closed = true })
    clientNet.triggerLeave()   // client transport saw the host leave
    expect(closed).toBe(true)
  })

  it('after match start, host leaving does NOT call onClosed (NetSession handles the disconnect)', () => {
    const [hostNet, clientNet] = createLoopbackPair('H', 'C')
    const host = new RoomSession(hostNet, 'host', 'AB12', HOST)
    const client = new RoomSession(clientNet, 'client', 'AB12', GUEST)
    let closed = false
    client.onClosed(() => { closed = true })
    host.start()               // client receives 'start' → started=true
    clientNet.triggerLeave()
    expect(closed).toBe(false)
  })

  it('ASSIGN did not arrive within connectTimeoutSec → onClosed', () => {
    vi.useFakeTimers()
    try {
      const [, clientNet] = createLoopbackPair('H', 'C')   // no host session → ASSIGN will not arrive
      const client = new RoomSession(clientNet, 'client', 'AB12', { ...GUEST, connectTimeoutSec: 5 })
      let closed = false
      client.onClosed(() => { closed = true })
      vi.advanceTimersByTime(5000)
      expect(closed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
