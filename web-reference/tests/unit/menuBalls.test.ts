import { describe, it, expect } from 'vitest'
import { computeBalls, type BallSpec } from '../../src/components/menuBalls'
import { STAGE_SPOTS, PLAYER_SPOT } from '../../src/components/menuStage'
import type { RosterEntry } from '../../src/net/protocol'

const PLAYER: BallSpec = { color: '#4af', model: 'smooth', ringColor: '#f4a', ballArt: 'myart' }

function entry(id: number, over: Partial<RosterEntry> = {}): RosterEntry {
  return { id, name: `P${id}`, color: `#00${id}`, kind: 'human', ...over }
}

describe('computeBalls — шары на сцене меню', () => {
  it('вне лобби — один свой шар на своём споте', () => {
    const balls = computeBalls('menu', PLAYER, null)
    expect(balls).toHaveLength(1)
    expect(balls[0].key).toBe('player')
    expect(balls[0].spot).toBe(PLAYER_SPOT)
    expect(balls[0].spec).toEqual(PLAYER)
  })

  it('4 участника → 4 шара, каждый на споте своего слота', () => {
    const roster = [entry(0), entry(1), entry(2), entry(3)]
    const balls = computeBalls('lobby', PLAYER, { roster, localPlayerId: 0 })
    expect(balls).toHaveLength(4)
    for (let slot = 0; slot < 4; slot++) {
      const b = balls.find(x => x.spot === STAGE_SPOTS[slot])!
      expect(b.spec.color).toBe(`#00${slot}`)
    }
  })

  it('чужой шар несёт ПОЛНЫЙ спек: ballArt и reserve-кольцо из ростера (фикс лобби-бага)', () => {
    // 'planet' ≠ PLAYER.model ('smooth') on purpose: proves the model comes from the ROSTER, not from our own spec.
    const roster = [entry(0), entry(1, { ballArt: 'art1', reserveColor: '#111', ballModel: 'planet' })]
    const balls = computeBalls('lobby', PLAYER, { roster, localPlayerId: 0 })
    const other = balls.find(b => b.key === 'slot-1')!
    expect(other.spec.ballArt).toBe('art1')
    expect(other.spec.ringColor).toBe('#111')
    expect(other.spec.model).toBe('planet')
  })

  it('свой шар: кольцо из живого профиля, ключ player, спот по слоту (гость слота 1)', () => {
    const roster = [entry(0), entry(1, { ballArt: 'rosterArt' })]
    const balls = computeBalls('lobby', PLAYER, { roster, localPlayerId: 1 })
    const me = balls.find(b => b.key === 'player')!
    expect(me.spot).toBe(STAGE_SPOTS[1])
    expect(me.spec.ringColor).toBe(PLAYER.ringColor)
    expect(me.spec.ballArt).toBe('rosterArt')
  })

  it('Duel: прежние два спота (0 и 1)', () => {
    const roster = [entry(0), entry(1)]
    const balls = computeBalls('lobby', PLAYER, { roster, localPlayerId: 0 })
    expect(balls.map(b => b.spot)).toEqual([STAGE_SPOTS[0], STAGE_SPOTS[1]])
  })

  it('клиент до ASSIGN (localPlayerId=-1): свой плейсхолдер на слоте 0 — это player', () => {
    const roster = [entry(0)]
    const balls = computeBalls('lobby', PLAYER, { roster, localPlayerId: -1 })
    expect(balls).toHaveLength(1)
    expect(balls[0].key).toBe('player')
    expect(balls[0].spot).toBe(STAGE_SPOTS[0])
  })
})
