import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { Match } from '../../src/game/Match'
import type { RosterEntry } from '../../src/net/protocol'
import type { MatchRole } from '../../src/constants'

const ROSTER: RosterEntry[] = [
  { id: 0, name: 'Вы', color: '#4af', kind: 'human' },
  { id: 1, name: 'Бот', color: '#5af', kind: 'bot', difficulty: 'passive' },
]

function makeMatch(role: MatchRole, opts: { durationMs?: number; dispatch?: ReturnType<typeof vi.fn> } = {}) {
  const dispatch = opts.dispatch ?? vi.fn()
  const match = new Match({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    controls: { current: null } as React.RefObject<any>,
    keys: { current: { forward: false, back: false, left: false, right: false } } as React.MutableRefObject<any>,
    dispatch,
    role,
    netConfig: { localId: 0, roster: ROSTER },
    durationMs: opts.durationMs,
  })
  return { match, dispatch }
}

describe('Match: конец по времени', () => {
  it('по истечении durationMs матч ends, исход по фрагам (ничья 0-0)', () => {
    const t0 = 2_000_000
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    const dispatch = vi.fn()
    const { match } = makeMatch('host', { durationMs: 5000, dispatch })
    match.forceLiveForTest()
    // Первый кадр: matchEndsAt = t0 + 5000; remaining = 5000 (не конец)
    match.update(0.016)
    expect(match.phase).toBe('live')
    // Перемотать время за конец матча
    spy.mockReturnValue(t0 + 5001)
    match.update(0.016)   // host-ветка: tickMatchClock увидит remaining=0 → endMatch('time')
    spy.mockRestore()
    expect(match.phase).toBe('ended')
    const ended = dispatch.mock.calls.find(c => c[0].type === 'SET_MATCH_RESULT')?.[0]
    expect(ended).toBeTruthy()
    expect(ended.result.reason).toBe('time')
    expect(ended.result.outcome).toBe('draw')   // 0-0
  })
})

describe('Match: отключение соперника', () => {
  it('handlePlayerLeft → ended, исход win, reason disconnect', () => {
    const dispatch = vi.fn()
    const { match } = makeMatch('host', { durationMs: 600000, dispatch })
    match.forceLiveForTest()
    match.handlePlayerLeft(1)
    expect(match.phase).toBe('ended')
    const r = dispatch.mock.calls.find(c => c[0].type === 'SET_MATCH_RESULT')?.[0].result
    expect(r.reason).toBe('disconnect')
    expect(r.outcome).toBe('win')
  })
})
