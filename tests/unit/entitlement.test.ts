import { describe, it, expect } from 'vitest'
import {
  FREE_GENS_PER_DAY, FREE_SAVES_PER_DAY, todayKey, rollTrial, entitlementFor,
  consumeGen, consumeSave, emptyTrial, type RadioTrial,
} from '../../src/radio/entitlement'

const d = (s: string) => new Date(s + 'T12:00:00')

describe('todayKey', () => {
  it('formats the LOCAL calendar day', () => {
    expect(todayKey(d('2026-06-28'))).toBe('2026-06-28')
  })
})

describe('rollTrial', () => {
  it('resets counters on a NEW day', () => {
    const t: RadioTrial = { day: '2026-06-27', gens: 9, saves: 4 }
    expect(rollTrial(t, d('2026-06-28'))).toEqual({ day: '2026-06-28', gens: 0, saves: 0 })
  })
  it('keeps counters on the SAME day', () => {
    const t: RadioTrial = { day: '2026-06-28', gens: 3, saves: 1 }
    expect(rollTrial(t, d('2026-06-28'))).toEqual(t)
  })
  it('does NOT reset when the clock moved BACKWARD (anti-abuse)', () => {
    const t: RadioTrial = { day: '2026-06-28', gens: 9, saves: 4 }
    expect(rollTrial(t, d('2026-06-27'))).toEqual(t) // keep the higher day + counts
  })
  it('seeds a fresh trial from undefined', () => {
    expect(rollTrial(undefined, d('2026-06-28'))).toEqual({ day: '2026-06-28', gens: 0, saves: 0 })
  })
})

describe('entitlementFor', () => {
  const trial: RadioTrial = { day: '2026-06-28', gens: 3, saves: 1 }
  it('unlimited when owned', () => {
    const e = entitlementFor({ owned: true, devUnlimited: false, trial })
    expect(e).toMatchObject({ unlimited: true, canGenerate: true, canSave: true })
    expect(e.gensLeft).toBe(Infinity)
  })
  it('unlimited in dev', () => {
    expect(entitlementFor({ owned: false, devUnlimited: true, trial }).unlimited).toBe(true)
  })
  it('trial: remaining = cap - used', () => {
    const e = entitlementFor({ owned: false, devUnlimited: false, trial })
    expect(e).toMatchObject({ unlimited: false, gensLeft: 7, savesLeft: 4, canGenerate: true, canSave: true })
  })
  it('trial: blocked at the cap', () => {
    const e = entitlementFor({ owned: false, devUnlimited: false, trial: { day: '2026-06-28', gens: 10, saves: 5 } })
    expect(e).toMatchObject({ gensLeft: 0, savesLeft: 0, canGenerate: false, canSave: false })
  })
})

describe('consume', () => {
  it('consumeGen increments + rolls a stale day', () => {
    expect(consumeGen({ day: '2026-06-27', gens: 9, saves: 0 }, d('2026-06-28'))).toEqual({ day: '2026-06-28', gens: 1, saves: 0 })
  })
  it('consumeSave increments on the same day', () => {
    expect(consumeSave({ day: '2026-06-28', gens: 0, saves: 4 }, d('2026-06-28'))).toEqual({ day: '2026-06-28', gens: 0, saves: 5 })
  })
})

describe('emptyTrial', () => {
  it('is a fresh zeroed trial for today', () => {
    expect(emptyTrial(d('2026-06-28'))).toEqual({ day: '2026-06-28', gens: 0, saves: 0 })
  })
})

describe('constants', () => {
  it('caps are 10 gens / 5 saves', () => { expect(FREE_GENS_PER_DAY).toBe(10); expect(FREE_SAVES_PER_DAY).toBe(5) })
})
