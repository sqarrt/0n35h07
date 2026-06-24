import { describe, it, expect } from 'vitest'
import { ClientReconciler } from '../../src/net/clientReconcile'

const SNAP_DIST = 0.5

describe('ClientReconciler — client prediction vs host authority', () => {
  it('no correction when the authority matches the predicted position for ackSeq', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(5, { x: 1, y: 1.7, z: 1 })
    expect(r.reconcile(5, { x: 1, y: 1.7, z: 1 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('no correction when divergence stays within the deadzone', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(5, { x: 0, y: 0, z: 0 })
    expect(r.reconcile(5, { x: 0.1, y: 0, z: -0.2 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('returns the full delta when divergence exceeds the deadzone', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(5, { x: 0, y: 0, z: 0 })
    expect(r.reconcile(5, { x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('returns zero for an unknown ackSeq (never recorded)', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(5, { x: 0, y: 0, z: 0 })
    expect(r.reconcile(3, { x: 99, y: 99, z: 99 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('prunes history older than the acked seq', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(3, { x: 0, y: 0, z: 0 })
    r.record(5, { x: 0, y: 0, z: 0 })
    r.reconcile(5, { x: 0, y: 0, z: 0 })        // acks seq 5 → drops everything older
    expect(r.reconcile(3, { x: 99, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('caps history to capacity (oldest entries fall off)', () => {
    const cap = 4
    const r = new ClientReconciler(SNAP_DIST, cap)
    for (let seq = 1; seq <= cap + 2; seq++) r.record(seq, { x: 0, y: 0, z: 0 })
    expect(r.reconcile(1, { x: 99, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })   // seq 1 evicted
    expect(r.reconcile(cap + 2, { x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 0 })   // newest kept
  })

  it('ackSeq 0 is the "nothing applied yet" sentinel — never corrects', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(0, { x: 0, y: 0, z: 0 })   // the very first frame is seq 0
    expect(r.reconcile(0, { x: 99, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('reset clears history (respawn/teleport invalidates old predictions)', () => {
    const r = new ClientReconciler(SNAP_DIST)
    r.record(5, { x: 0, y: 0, z: 0 })
    r.reset()
    expect(r.reconcile(5, { x: 99, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })
})
