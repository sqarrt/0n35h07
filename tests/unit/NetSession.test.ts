import { describe, it, expect, vi } from 'vitest'
import { createLoopbackHub } from '../../src/net/LoopbackNet'
import { NetSession } from '../../src/net/NetSession'
import type { MatchNet } from '../../src/net/NetSession'
import type { MatchEvent, Snapshot, HitClaim, PhaseMsg } from '../../src/net/protocol'
import { NET_SNAPSHOT_HZ } from '../../src/constants'

const SNAP: Snapshot = { ackTick: 0, tick: 1, buffered: 0, players: [] }
const PHASE: PhaseMsg = { phase: 'countdown', ready: [0, 1, 2] }

/** Минимальный симметричный MatchNet: записывает входящее, отдаёт заготовленное исходящее. */
function fakeMatch(over: Partial<{ creator: 'self' | string; events: MatchEvent[]; claims: Array<{ to: string; claim: HitClaim }>; dirty: boolean }> = {}) {
  const calls = {
    snapshots: [] as Array<[string, Snapshot]>,
    events: [] as Array<[string, MatchEvent]>,
    claims: [] as Array<[string, HitClaim]>,
    phases: [] as PhaseMsg[],
    left: [] as string[],
  }
  let dirty = over.dirty ?? false
  let events = over.events ?? []
  let claims = over.claims ?? []
  const m: MatchNet = {
    localId: 0,
    serializeSnapshot: () => SNAP,
    drainEvents: () => { const e = events; events = []; return e },
    drainClaims: () => { const c = claims; claims = []; return c },
    applyPeerSnapshot: (from, s) => calls.snapshots.push([from, s]),
    applyPeerEvent: (from, e) => calls.events.push([from, e]),
    judgeIncomingClaim: (from, c) => calls.claims.push([from, c]),
    applyPhase: p => calls.phases.push(p),
    serializePhase: () => PHASE,
    phaseDirty: () => dirty,
    clearPhaseDirty: () => { dirty = false },
    iAmCreator: () => over.creator === 'self',
    creatorPeer: () => (over.creator === 'self' ? 'SELF' : over.creator ?? 'A'),
    handlePeerLeft: peer => calls.left.push(peer),
  }
  return { m, calls }
}

describe('NetSession — симметричный меш (LoopbackHub, 3 пира)', () => {
  it('событие пира разлетается обоим соседям с атрибуцией from', () => {
    const [a, b, c] = createLoopbackHub(['A', 'B', 'C'])
    const fa = fakeMatch({ events: [{ t: 'ready', id: 0 }] })
    const fb = fakeMatch()
    const fc = fakeMatch()
    const sa = new NetSession(a, fa.m); new NetSession(b, fb.m); new NetSession(c, fc.m)
    sa.afterUpdate(0)
    expect(fb.calls.events).toEqual([['A', { t: 'ready', id: 0 }]])
    expect(fc.calls.events).toEqual([['A', { t: 'ready', id: 0 }]])
  })

  it('claim уходит АДРЕСНО владельцу жертвы — третий пир его не видит', () => {
    const [a, b, c] = createLoopbackHub(['A', 'B', 'C'])
    const claim: HitClaim = { shooter: 0, hitId: 1, point: null, end: [0, 0, 0] }
    const fa = fakeMatch({ claims: [{ to: 'B', claim }] })
    const fb = fakeMatch()
    const fc = fakeMatch()
    const sa = new NetSession(a, fa.m); new NetSession(b, fb.m); new NetSession(c, fc.m)
    sa.afterUpdate(0)
    expect(fb.calls.claims).toEqual([['A', claim]])
    expect(fc.calls.claims).toEqual([])
  })

  it('снапшоты троттлятся до NET_SNAPSHOT_HZ и применяются с from', () => {
    const [a, b] = createLoopbackHub(['A', 'B'])
    const fa = fakeMatch()
    const fb = fakeMatch()
    const sa = new NetSession(a, fa.m); new NetSession(b, fb.m)
    const interval = 1000 / NET_SNAPSHOT_HZ
    sa.afterUpdate(interval)          // первый — уходит
    sa.afterUpdate(interval + 5)      // слишком рано — нет
    sa.afterUpdate(interval * 2 + 1)  // прошёл интервал — уходит
    expect(fb.calls.snapshots.map(([from]) => from)).toEqual(['A', 'A'])
  })

  it('фазу рассылает ТОЛЬКО создатель; не-создатель лишь чистит свой флаг', () => {
    const [a, b, c] = createLoopbackHub(['A', 'B', 'C'])
    const fa = fakeMatch({ creator: 'self', dirty: true })   // A — создатель
    const fb = fakeMatch({ creator: 'A', dirty: true })      // B тоже dirty, но не создатель
    const fc = fakeMatch({ creator: 'A' })
    const sa = new NetSession(a, fa.m)
    const sb = new NetSession(b, fb.m)
    new NetSession(c, fc.m)
    sb.afterUpdate(0)                                        // не-создатель: рассылки нет
    expect(fa.calls.phases).toEqual([])
    expect(fc.calls.phases).toEqual([])
    sa.afterUpdate(0)                                        // создатель рассылает всем
    expect(fb.calls.phases).toEqual([PHASE])
    expect(fc.calls.phases).toEqual([PHASE])
  })

  it('фаза от НЕ-создателя отбрасывается получателем', () => {
    const [a, b] = createLoopbackHub(['A', 'B'])
    const fa = fakeMatch({ creator: 'X' })                   // A считает создателем пира X
    new NetSession(a, fa.m)
    const fb = fakeMatch({ creator: 'self', dirty: true })   // B мнит себя создателем и шлёт фазу
    const sb = new NetSession(b, fb.m)
    sb.afterUpdate(0)
    expect(fa.calls.phases).toEqual([])                      // 'B' ≠ creatorPeer 'X' → дроп
  })

  it('уход пира → handlePeerLeft с его transport-id', () => {
    const [a] = createLoopbackHub(['A', 'B'])
    const fa = fakeMatch()
    new NetSession(a, fa.m)
    a.triggerLeave('B')
    expect(fa.calls.left).toEqual(['B'])
  })

  it('dispose покидает транспорт', () => {
    const [a] = createLoopbackHub(['A', 'B'])
    const fa = fakeMatch()
    const s = new NetSession(a, fa.m)
    const spy = vi.spyOn(a, 'leave')
    s.dispose()
    expect(spy).toHaveBeenCalled()
  })
})
