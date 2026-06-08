import type { ISfxEngine, SfxEvent } from './types'

/** Тестовый двойник: записывает вызовы (three-аудио в jsdom не работает). */
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
  /** Сколько раз сыграно событие (любым методом). */
  played(event: SfxEvent) { return this.calls.filter(c => c.event === event).length }
  clear() { this.calls = [] }
}
