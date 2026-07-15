import { describe, it, expect } from 'vitest'
import { lobbyStateFrom } from '../../src/components/lobby/lobbyState'
import type { RoomView } from '../../src/net/RoomSession'
import type { RosterEntry } from '../../src/net/protocol'

const SELF = { name: 'Me', color: '#4af' }
const DRAFT = { map: ['os_arena' as const], durationMin: [5] }

const human = (id: number, name: string): RosterEntry => ({ id, name, color: '#4af', kind: 'human' })
const bot = (id: number, name: string): RosterEntry => ({ id, name, color: '#5af', kind: 'bot', difficulty: 'normal' })

function view(over: Partial<RoomView> = {}): RoomView {
  const slots = over.slots ?? [human(0, 'Host'), null]
  return {
    roster: slots.filter((s): s is RosterEntry => s !== null),
    slots,
    mode: '1v1', localPlayerId: 0, isHost: true, connected: true, foundHost: true, canStart: false,
    durationMin: 5, mapId: 'os_arena', mapSel: ['os_arena'], durationSel: [5], ready: [],
    ...over,
  }
}

describe('lobbyStateFrom — без сессии (Steam-лобби ещё формируется)', () => {
  it('хост: я на месте 0, дуэльная пара, экран не мигает пустым', () => {
    const s = lobbyStateFrom({ view: null, self: SELF, draft: DRAFT, fallbackIsHost: true })
    expect(s.seats).toHaveLength(2)
    expect(s.seats[0].entry).toEqual({ name: 'Me', color: '#4af', ready: false, isBot: false })
    expect(s.seats[0].mine).toBe(true)
    expect(s.seats[1].entry).toBeNull()
    expect(s.isHost).toBe(true)
    expect(s.connected).toBe(false)
  })

  it('гость: я на месте 1 — сторона стабильна до ASSIGN', () => {
    const s = lobbyStateFrom({ view: null, self: SELF, draft: DRAFT, fallbackIsHost: false })
    expect(s.seats[1].mine).toBe(true)
    expect(s.seats[0].entry).toBeNull()
  })

  it('карта и время берутся из своих пожеланий, пока сессия их не согласовала', () => {
    const s = lobbyStateFrom({ view: null, self: SELF, draft: { map: ['os_india'], durationMin: [3, 10] }, fallbackIsHost: true })
    expect(s.mapSel).toEqual(['os_india'])
    expect(s.durationSel).toEqual([3, 10])
  })
})

describe('lobbyStateFrom — с сессией', () => {
  it('хост видит занятые места, флаги готовности и ботов', () => {
    const s = lobbyStateFrom({
      view: view({ slots: [human(0, 'Host'), bot(1, 'RA9')], ready: [1], canStart: true }),
      self: SELF, draft: DRAFT, fallbackIsHost: true,
    })
    expect(s.seats[0].entry).toMatchObject({ name: 'Host', isBot: false, ready: false })
    expect(s.seats[0].mine).toBe(true)
    expect(s.seats[1].entry).toMatchObject({ name: 'RA9', isBot: true, ready: true, difficulty: 'normal' })
    expect(s.canStart).toBe(true)
    expect(s.myReady).toBe(false)
  })

  it('гость ДО ASSIGN не видит чужие места — иначе заглушка хоста читается как «матч с самим собой»', () => {
    const s = lobbyStateFrom({
      view: view({ isHost: false, connected: false, localPlayerId: -1, slots: [human(0, 'Host'), null] }),
      self: SELF, draft: DRAFT, fallbackIsHost: false,
    })
    expect(s.seats[0].entry).toBeNull()
    expect(s.seats.every(seat => seat.mine === false)).toBe(true)   // своего места ещё нет
  })

  it('гость ПОСЛЕ ASSIGN видит всех и своё место', () => {
    const s = lobbyStateFrom({
      view: view({ isHost: false, connected: true, localPlayerId: 1, slots: [human(0, 'Host'), human(1, 'Me')], ready: [1] }),
      self: SELF, draft: DRAFT, fallbackIsHost: false,
    })
    expect(s.seats[0].entry).toMatchObject({ name: 'Host' })
    expect(s.seats[1].mine).toBe(true)
    expect(s.myReady).toBe(true)
  })

  it('2v2: места разложены по командам (0,0,1,1)', () => {
    const s = lobbyStateFrom({
      view: view({ mode: '2v2', slots: [human(0, 'A'), human(1, 'B'), bot(2, 'C'), bot(3, 'D')] }),
      self: SELF, draft: DRAFT, fallbackIsHost: true,
    })
    expect(s.seats.map(x => x.team)).toEqual([0, 0, 1, 1])
  })

  it('ffa: каждый сам за себя (0,1,2,3)', () => {
    const s = lobbyStateFrom({
      view: view({ mode: 'ffa', slots: [human(0, 'A'), human(1, 'B'), null, null] }),
      self: SELF, draft: DRAFT, fallbackIsHost: true,
    })
    expect(s.seats.map(x => x.team)).toEqual([0, 1, 2, 3])
  })
})
