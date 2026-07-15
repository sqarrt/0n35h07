import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MatchSfx } from '../../src/game/audio/sfx/MatchSfx'
import type { PlayerSfxInput } from '../../src/game/audio/sfx/MatchSfx'
import { FakeSfxEngine } from '../../src/game/audio/sfx/FakeSfxEngine'
import { windupSfxEvent } from '../../src/game/audio/sfx/windupSfx'

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
    sfx.combat({ t: 'block', shooter: 0, victim: 1, perfect: false }, () => pos())
    sfx.combat({ t: 'kill', shooter: 0, victim: 1 }, () => pos())
    sfx.combat({ t: 'respawn', id: 1, pos: [0, 1, 0] }, () => pos())
    expect(fake.played('block')).toBe(1)
    expect(fake.played('death')).toBe(1)
    expect(fake.played('respawn')).toBe(1)
  })

  it('beam_fire does NOT play on the fired event (sound starts at windup start, see frame)', () => {
    const fake = new FakeSfxEngine()
    new MatchSfx(fake).combat({ t: 'fired', id: 1, end: [0, 0, 0], hitPoint: null, hit: null }, () => pos())
    expect(fake.played('beam_fire')).toBe(0)
  })

  it('ignores non-combat events (ready)', () => {
    const fake = new FakeSfxEngine()
    new MatchSfx(fake).combat({ t: 'ready', id: 1 }, () => pos())
    expect(fake.calls.length).toBe(0)
  })
})

describe('MatchSfx.frame', () => {
  it('shield off→on: shield_up + startLoop; on→off: shield_down + stopLoop', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ shieldActive: false })])
    sfx.frame([input({ shieldActive: true })])
    expect(fake.played('shield_up')).toBe(1)
    expect(fake.calls.some(c => c.method === 'startLoop' && c.event === 'shield_loop')).toBe(true)
    sfx.frame([input({ shieldActive: false })])
    expect(fake.played('shield_down')).toBe(1)
    expect(fake.calls.some(c => c.method === 'stopLoop')).toBe(true)
  })

  it('windup false→true → beam_fire (once, at the START of windup)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ windingUp: false })])
    sfx.frame([input({ windingUp: true })])
    sfx.frame([input({ windingUp: true })])
    expect(fake.played('beam_fire')).toBe(1)
  })

  it('dash false→true → dash (once)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ dashing: false })])
    sfx.frame([input({ dashing: true })])
    sfx.frame([input({ dashing: true })])
    expect(fake.played('dash')).toBe(1)
  })

  it('jump is NOT sounded (by request — only landing)', () => {
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

  it('cooldown_ready — when dash OR shield became ready (local only)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ dashReady: false, shieldReady: true })])
    sfx.frame([input({ dashReady: true, shieldReady: true })])   // dash became ready
    expect(fake.played('cooldown_ready')).toBe(1)
  })

  it('move(): sounds the opponent landing', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.move('land', new THREE.Vector3())
    expect(fake.played('land')).toBe(1)
  })

  it('throttle: frequent landings in a row are suppressed (≤ once per window)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ grounded: false })], 0)
    sfx.frame([input({ grounded: true })], 100)    // land #1
    sfx.frame([input({ grounded: false })], 110)
    sfx.frame([input({ grounded: true })], 120)    // after 20ms → suppressed
    expect(fake.played('land')).toBe(1)
  })

  it('throttle: a single landing (after airtime) plays', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ grounded: false })], 0)
    sfx.frame([input({ grounded: true })], 500)                    // landing after airtime → plays
    expect(fake.played('land')).toBe(1)
  })

  it('throttle: per-player (one landing does not mute another)', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 0, grounded: false }), input({ id: 1, grounded: false })], 0)
    sfx.frame([input({ id: 0, grounded: true }), input({ id: 1, grounded: true })], 100)
    expect(fake.played('land')).toBe(2)   // different players — both heard
  })

  it('own sounds are 2D, opponent ones are positional', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 0, isLocal: true, grounded: false }), input({ id: 1, isLocal: false, grounded: false })], 0)
    sfx.frame([input({ id: 0, isLocal: true, grounded: true }), input({ id: 1, isLocal: false, grounded: true })], 100)
    expect(fake.calls.filter(c => c.event === 'land' && c.method === 'play2D').length).toBe(1)   // own — non-positional
    expect(fake.calls.filter(c => c.event === 'land' && c.method === 'playAt').length).toBe(1)   // opponent — positional
  })

  it('own shield loop is 2D (target=null), opponent one is positional', () => {
    const fake = new FakeSfxEngine(); const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 0, isLocal: true, shieldActive: true })])
    sfx.frame([input({ id: 1, isLocal: false, shieldActive: true })])
    const loops = fake.calls.filter(c => c.method === 'startLoop' && c.event === 'shield_loop')
    expect(loops.length).toBe(2)
  })
})

describe('windup: sound by style', () => {
  it('each style plays its own sound when assets are present', () => {
    const fake = new FakeSfxEngine()
    const sfx = new MatchSfx(fake)
    sfx.frame([input({ id: 1, windingUp: true, windupStyle: 'rage' })])
    sfx.frame([input({ id: 2, windingUp: true, windupStyle: 'classic' })])
    sfx.frame([input({ id: 3, windingUp: true, windupStyle: 'singularity' })])
    expect(fake.played('beam_fire_rage')).toBe(1)
    expect(fake.played('beam_fire_singularity')).toBe(1)
    expect(fake.played('beam_fire')).toBe(1)
  })

  it('style without an asset (buffer not loaded) → fallback beam_fire', () => {
    const fake = new FakeSfxEngine()
    fake.missing.add('beam_fire_singularity')
    new MatchSfx(fake).frame([input({ windingUp: true, windupStyle: 'singularity' })])
    expect(fake.played('beam_fire')).toBe(1)
    expect(fake.played('beam_fire_singularity')).toBe(0)
  })

  it('windupSfxEvent: mapping + fallback', () => {
    const fake = new FakeSfxEngine()
    expect(windupSfxEvent('rage', fake)).toBe('beam_fire_rage')
    fake.missing.add('beam_fire_rage')
    expect(windupSfxEvent('rage', fake)).toBe('beam_fire')
    expect(windupSfxEvent(undefined, fake)).toBe('beam_fire')
  })
})
