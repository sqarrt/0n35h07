import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MatchSfx } from '../../src/game/audio/sfx/MatchSfx'
import type { PlayerSfxInput } from '../../src/game/audio/sfx/MatchSfx'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'

const pos = () => new THREE.Vector3(1, 2, 3)

function input(over: Partial<PlayerSfxInput> = {}): PlayerSfxInput {
  return {
    id: 1, obj: new THREE.Object3D(), pos: new THREE.Vector3(),
    shieldActive: false, dashing: false, grounded: true, justJumped: false,
    dashReady: null, shieldReady: null, windingUp: false, isLocal: false, ...over,
  }
}

describe('MatchSfx.combat', () => {
  it('block→block, kill→death, respawn→respawn', () => {
    const fake = new FakeSfxEngine()
    const sfx = new MatchSfx(fake)
    sfx.combat({ t: 'block', shooter: 0, victim: 1 }, () => pos())
    sfx.combat({ t: 'kill', shooter: 0, victim: 1 }, () => pos())
    sfx.combat({ t: 'respawn', id: 1, pos: [0, 1, 0] }, () => pos())
    expect(fake.played('block')).toBe(1)
    expect(fake.played('death')).toBe(1)
    expect(fake.played('respawn')).toBe(1)
  })

  it('beam_fire НЕ играется по событию fired (звук стартует с начала заряда, см. frame)', () => {
    const fake = new FakeSfxEngine()
    new MatchSfx(fake).combat({ t: 'fired', id: 1, end: [0, 0, 0], hitPoint: null, hit: null }, () => pos())
    expect(fake.played('beam_fire')).toBe(0)
  })

  it('игнорирует не-боевые события (scores/time)', () => {
    const fake = new FakeSfxEngine()
    new MatchSfx(fake).combat({ t: 'time', remainingMs: 1000 }, () => pos())
    expect(fake.calls.length).toBe(0)
  })
})

describe('MatchSfx.frame', () => {
  it('щит off→on: shield_up + startLoop; on→off: shield_down + stopLoop', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ shieldActive: false })])
    sfx.frame([input({ shieldActive: true })])
    expect(fake.played('shield_up')).toBe(1)
    expect(fake.calls.some(c => c.method === 'startLoop' && c.event === 'shield_loop')).toBe(true)
    sfx.frame([input({ shieldActive: false })])
    expect(fake.played('shield_down')).toBe(1)
    expect(fake.calls.some(c => c.method === 'stopLoop')).toBe(true)
  })

  it('заряд false→true → beam_fire (один раз, на НАЧАЛЕ windup)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ windingUp: false })])
    sfx.frame([input({ windingUp: true })])
    sfx.frame([input({ windingUp: true })])
    expect(fake.played('beam_fire')).toBe(1)
  })

  it('рывок false→true → dash (один раз)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ dashing: false })])
    sfx.frame([input({ dashing: true })])
    sfx.frame([input({ dashing: true })])
    expect(fake.played('dash')).toBe(1)
  })

  it('прыжок НЕ озвучивается (по запросу — только приземление)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    const moves = sfx.frame([input({ justJumped: true })])
    expect(fake.played('jump')).toBe(0)
    expect(moves).toEqual([])
  })

  it('grounded false→true → land', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ grounded: false })])
    sfx.frame([input({ grounded: true })])
    expect(fake.played('land')).toBe(1)
  })

  it('cooldown_ready — когда рывок ИЛИ щит перешёл в готов (только локальный)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ dashReady: false, shieldReady: true })])
    sfx.frame([input({ dashReady: true, shieldReady: true })])   // рывок стал готов
    expect(fake.played('cooldown_ready')).toBe(1)
  })

  it('move(): озвучивает приземление соперника', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.move('land', new THREE.Vector3())
    expect(fake.played('land')).toBe(1)
  })

  it('throttle: частые приземления подряд подавляются (≤ раз в окно)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ grounded: false })], 0)
    sfx.frame([input({ grounded: true })], 100)    // land #1
    sfx.frame([input({ grounded: false })], 110)
    sfx.frame([input({ grounded: true })], 120)    // через 20мс → подавлено
    expect(fake.played('land')).toBe(1)
  })

  it('throttle: одиночное приземление (после полёта) звучит', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ grounded: false })], 0)
    sfx.frame([input({ grounded: true })], 500)                    // приземление после полёта → звучит
    expect(fake.played('land')).toBe(1)
  })

  it('throttle: пер-игрок (приземление одного не глушит приземление другого)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 0, grounded: false }), input({ id: 1, grounded: false })], 0)
    sfx.frame([input({ id: 0, grounded: true }), input({ id: 1, grounded: true })], 100)
    expect(fake.played('land')).toBe(2)   // разные игроки — оба слышны
  })

  it('свои звуки — 2D, соперника — позиционные', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 0, isLocal: true, grounded: false }), input({ id: 1, isLocal: false, grounded: false })], 0)
    sfx.frame([input({ id: 0, isLocal: true, grounded: true }), input({ id: 1, isLocal: false, grounded: true })], 100)
    expect(fake.calls.filter(c => c.event === 'land' && c.method === 'play2D').length).toBe(1)   // свой — непозиционно
    expect(fake.calls.filter(c => c.event === 'land' && c.method === 'playAt').length).toBe(1)   // соперник — позиционно
  })

  it('свой щит-луп — 2D (target=null), соперника — позиционный', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 0, isLocal: true, shieldActive: true })])
    sfx.frame([input({ id: 1, isLocal: false, shieldActive: true })])
    const loops = fake.calls.filter(c => c.method === 'startLoop' && c.event === 'shield_loop')
    expect(loops.length).toBe(2)
  })
})
