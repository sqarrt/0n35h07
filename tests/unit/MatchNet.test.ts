import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { RosterEntry, Snapshot } from '../../src/net/protocol'
import type { MatchRole } from '../../src/constants'
import { READY_COUNTDOWN_MS } from '../../src/constants'

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'A', color: '#4af', kind: 'human' },
  { id: 1, name: 'B', color: '#f44', kind: 'human' },
]

function makeMatch(role: MatchRole, localId: number, roster: RosterEntry[] = ROSTER) {
  const dispatch = vi.fn()
  const match = new Match({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    controls: { current: null } as React.RefObject<any>,
    keys: { current: { forward: false, back: false, left: false, right: false } } as React.MutableRefObject<any>,
    dispatch,
    role,
    netConfig: { localId, roster },
  })
  return { match, dispatch }
}

describe('Match — сетевой режим', () => {
  it('host строит обоих игроков; serializeSnapshot отдаёт 2 снимка', () => {
    const { match } = makeMatch('host', 0)
    expect(match.players.map(p => p.id).sort()).toEqual([0, 1])
    const snap = match.serializeSnapshot()
    expect(snap.players.map(p => p.id).sort()).toEqual([0, 1])
  })

  it('client применяет KILL: счёт растёт, шлёт PLAYER_HIT для локальной жертвы', () => {
    const { match, dispatch } = makeMatch('client', 1)
    match.applyEvent({ t: 'kill', shooter: 0, victim: 1 })
    expect(match.players.find(p => p.id === 1)!.deaths).toBe(1)
    expect(match.players.find(p => p.id === 0)!.kills).toBe(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLAYER_HIT' })
  })

  it('client applySnapshot: и удалённый, и свой получают цель (свой — для реконсиляции)', () => {
    const { match } = makeMatch('client', 1)
    const snap: Snapshot = {
      ackSeq: 0,
      players: [
        { id: 0, pos: [3, 1.7, 0], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false },
        { id: 1, pos: [9, 9, 9], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0, respawning: false },
      ],
    }
    match.applySnapshot(snap)
    // Удалённый интерполируется к цели; свой хранит авторитет для мягкой коррекции (KCC + reconcileLocal).
    expect(match.players.find(p => p.id === 0)!.hasNetTarget()).toBe(true)
    expect(match.players.find(p => p.id === 1)!.hasNetTarget()).toBe(true)
  })

  it('host с ботом-соперником: бот в ростере попадает в снапшот', () => {
    const roster: RosterEntry[] = [
      { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
      { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'normal' },
    ]
    const { match } = makeMatch('host', 0, roster)
    expect(match.players.map(p => p.id).sort()).toEqual([0, 1])
    expect(match.serializeSnapshot().players).toHaveLength(2)
  })

  it('1v1 стартует в phase=countdown и замораживает игроков', () => {
    const { match } = makeMatch('host', 0)
    expect(match.phase).toBe('countdown')
    match.update(0.016)   // tickPhase → заморозка (идёт отсчёт)
    match.human.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(match.human.consumeDesired().x).toBe(0)
  })

  it('старт с отсчёта; по истечении countdown → live и разморозка', () => {
    const t0 = 1_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const { match } = makeMatch('host', 0)
    expect(match.phase).toBe('countdown')   // матч стартует сразу с отсчёта
    spy.mockReturnValue(t0 + READY_COUNTDOWN_MS + 1)
    match.update(0.016)   // tickPhase: countdown → live
    expect(match.phase).toBe('live')
    match.human.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    match.human.stepHorizontal(0.016, null)   // скоростная модель реализует намерение в desired
    expect(match.human.consumeDesired().x).toBeGreaterThan(0)   // разморожен
    spy.mockRestore()
  })

  it('client applyPhase применяет фазу хоста', () => {
    const { match } = makeMatch('client', 1)
    expect(match.phase).toBe('countdown')   // клиент тоже стартует с отсчёта
    match.applyPhase({ phase: 'live', ready: [] })
    expect(match.phase).toBe('live')
  })

  it('handlePlayerLeft: фаза ended, аватар скрыт, шлёт SET_MATCH_RESULT disconnect/win', () => {
    const { match, dispatch } = makeMatch('host', 0)
    const opponent = match.players.find(p => p.id === 1)!
    const t0 = 5_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    match.handlePlayerLeft(1)
    expect(match.phase).toBe('ended')
    expect(opponent.bodyGroup.visible).toBe(false)
    // Экран исхода отложен на END_FREEZE_MS — диспатчится после стоп-кадра.
    spy.mockReturnValue(t0 + 250)
    match.update(0.016)
    spy.mockRestore()
    const result = dispatch.mock.calls.find(c => c[0].type === 'SET_MATCH_RESULT')?.[0]
    expect(result).toBeTruthy()
    expect(result.result.reason).toBe('disconnect')
    expect(result.result.outcome).toBe('win')
    // ended → заморозка
    match.update(0.016)
    match.human.moveIntent(new THREE.Vector3(5, 0, 0), 1)
    expect(match.human.consumeDesired().x).toBe(0)
  })

  it('client сбрасывает justFired своего игрока (шар сдувается после выстрела)', () => {
    const { match } = makeMatch('client', 1)
    match.human.startFiring()
    match.update(0.5)   // 0.5с > BEAM_WINDUP(0.4с) → выстрел происходит в этом кадре
    expect(match.human.weaponJustFired).toBe(false)   // флаг очищен (resolveCombat на клиенте не идёт)
  })

  it('host: ввод клиента применяется к его аватару после старта боя (pushRemoteInput → update)', () => {
    const t0 = 2_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const { match } = makeMatch('host', 0)
    spy.mockReturnValue(t0 + READY_COUNTDOWN_MS + 1)
    match.update(0.016)   // отсчёт прошёл → live (разморозка)
    spy.mockRestore()
    expect(match.phase).toBe('live')

    match.pushRemoteInput(1, { seq: 1, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1], jump: false, fire: true, shield: false, dash: false })
    match.update(0.016)
    expect(match.players.find(p => p.id === 1)!.isWindingUp).toBe(true)   // fire применился к аватару клиента
  })
})
