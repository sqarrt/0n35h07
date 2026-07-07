import { describe, it, expect } from 'vitest'
import { DemoRecorder } from '../../src/game/demo/DemoRecorder'
import { DEFAULT_MAP_ID } from '../../src/constants'
import type { RosterEntry } from '../../src/net/protocol'

describe('DemoRecorder', () => {
  it('the demo reserveColor comes from the local player roster entry', () => {
    const roster: RosterEntry[] = [
      { id: 0, name: 'You', color: '#4af', reserveColor: '#fa4', kind: 'human' },
      { id: 1, name: 'Bot', color: '#5af', kind: 'bot' },
    ]
    const rec = new DemoRecorder({ roster, mapId: DEFAULT_MAP_ID, durationMs: 60_000, localId: 0 })
    expect(rec.build().reserveColor).toBe('#fa4')
  })

  it('roster without reserveColor (older peer) — falls back to the primary color', () => {
    const roster: RosterEntry[] = [{ id: 0, name: 'You', color: '#4af', kind: 'human' }]
    const rec = new DemoRecorder({ roster, mapId: DEFAULT_MAP_ID, durationMs: 60_000, localId: 0 })
    expect(rec.build().reserveColor).toBe('#4af')
  })
})
