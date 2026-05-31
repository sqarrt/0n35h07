import { describe, it, expect, vi } from 'vitest'
import { createLoopbackPair } from '../../src/net/LoopbackNet'
import { NetSession } from '../../src/net/NetSession'
import type { MatchNet } from '../../src/net/NetSession'
import type { InputFrame, Snapshot, MatchEvent, PhaseMsg } from '../../src/net/protocol'
import type { MatchRole } from '../../src/constants'

function frame(seq: number): InputFrame {
  return { seq, keys: { f: true, b: false, l: false, r: false }, aimDir: [0, 0, -1], jump: false, fire: false, shield: false, dash: false }
}
const SNAP: Snapshot = { ackSeq: 3, players: [{ id: 0, pos: [0, 1.7, 5], aimDir: [0, 0, -1], alive: true, shieldActive: false, dashing: false, windupProgress: 0 }] }
const EVENT: MatchEvent = { t: 'kill', shooter: 0, victim: 1 }
const PHASE: PhaseMsg = { phase: 'countdown', ready: [0, 1] }

type Stub = MatchNet & {
  pushed: Array<[number, InputFrame]>; snaps: Snapshot[]; events: MatchEvent[]
  readyCalls: number[]; phases: PhaseMsg[]; setDirty(v: boolean): void
}

function stub(role: MatchRole, localId: number): Stub {
  const pushed: Array<[number, InputFrame]> = []
  const snaps: Snapshot[] = []
  const events: MatchEvent[] = []
  const readyCalls: number[] = []
  const phases: PhaseMsg[] = []
  let dirty = false
  return {
    role, localId, pushed, snaps, events, readyCalls, phases,
    setDirty: v => { dirty = v },
    serializeSnapshot: () => SNAP,
    drainEvents: vi.fn(() => [EVENT]) as unknown as () => MatchEvent[],
    pushRemoteInput: (pid, f) => { pushed.push([pid, f]) },
    applySnapshot: s => { snaps.push(s) },
    applyEvent: e => { events.push(e) },
    localInputFrame: seq => frame(seq),
    markReady: id => { readyCalls.push(id) },
    applyPhase: p => { phases.push(p) },
    serializePhase: () => PHASE,
    phaseDirty: () => dirty,
    clearPhaseDirty: () => { dirty = false },
  }
}

describe('NetSession (host ↔ client через LoopbackNet)', () => {
  it('клиент шлёт ввод → хост маршрутизирует в pushRemoteInput по peer→player', () => {
    const [hostNet, clientNet] = createLoopbackPair('host', 'client')
    const host = stub('host', 0)
    stub('client', 1)
    new NetSession(hostNet, host, new Map([['client', 1]]))
    const clientSession = new NetSession(clientNet, stub('client', 1), new Map([['host', 0]]))

    clientSession.afterUpdate(0)
    expect(host.pushed).toHaveLength(1)
    expect(host.pushed[0][0]).toBe(1)              // playerId клиента
    expect(host.pushed[0][1].seq).toBe(0)
  })

  it('хост рассылает события и снапшот → клиент применяет', () => {
    const [hostNet, clientNet] = createLoopbackPair('host', 'client')
    const client = stub('client', 1)
    const hostSession = new NetSession(hostNet, stub('host', 0), new Map([['client', 1]]))
    new NetSession(clientNet, client, new Map([['host', 0]]))

    hostSession.afterUpdate(1000)
    expect(client.events).toEqual([EVENT])
    expect(client.snaps).toEqual([SNAP])
  })

  it('снапшоты троттлятся по NET_SNAPSHOT_HZ', () => {
    const [hostNet, clientNet] = createLoopbackPair('host', 'client')
    const client = stub('client', 1)
    const hostSession = new NetSession(hostNet, stub('host', 0), new Map([['client', 1]]))
    new NetSession(clientNet, client, new Map([['host', 0]]))

    hostSession.afterUpdate(1000)
    hostSession.afterUpdate(1000)   // тот же момент — снапшот не повторяется
    expect(client.snaps).toHaveLength(1)
  })

  it('client sendReady() → host markReady(playerId клиента)', () => {
    const [hostNet, clientNet] = createLoopbackPair('host', 'client')
    const host = stub('host', 0)
    new NetSession(hostNet, host, new Map([['client', 1]]))
    const clientSession = new NetSession(clientNet, stub('client', 1), new Map([['host', 0]]))
    clientSession.sendReady()
    expect(host.readyCalls).toEqual([1])
  })

  it('host рассылает фазу при phaseDirty → клиент applyPhase', () => {
    const [hostNet, clientNet] = createLoopbackPair('host', 'client')
    const client = stub('client', 1)
    const host = stub('host', 0)
    host.setDirty(true)
    const hostSession = new NetSession(hostNet, host, new Map([['client', 1]]))
    new NetSession(clientNet, client, new Map([['host', 0]]))
    hostSession.afterUpdate(1000)
    expect(client.phases).toEqual([PHASE])
    expect(host.phaseDirty()).toBe(false)   // очищен после рассылки
  })
})
