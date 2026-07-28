import type { ISfxEngine, SfxEvent } from './types'

/** Test double: records calls (three audio doesn't work in jsdom). */
export class FakeSfxEngine implements ISfxEngine {
  calls: { method: string; event?: SfxEvent; key?: string }[] = []
  async load() {}
  attach() {}
  detach() {}
  playAt(event: SfxEvent) { this.calls.push({ method: 'playAt', event }) }
  play2D(event: SfxEvent) { this.calls.push({ method: 'play2D', event }) }
  startLoop(event: SfxEvent, key: string) { this.calls.push({ method: 'startLoop', event, key }) }
  stopLoop(key: string) { this.calls.push({ method: 'stopLoop', key }) }
  setMasterGain() {}
  dispose() {}
  missing = new Set<SfxEvent>()   // test knob: an event "with no asset"
  has(event: SfxEvent) { return !this.missing.has(event) }
  /** How many times an event was played (by any method). */
  played(event: SfxEvent) { return this.calls.filter(c => c.event === event).length }
  clear() { this.calls = [] }
}
