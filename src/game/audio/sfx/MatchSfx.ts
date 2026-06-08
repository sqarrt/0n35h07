import * as THREE from 'three'
import type { ISfxEngine } from './types'
import type { MatchEvent } from '../../../net/protocol'

/** Логика триггеров SFX матча. Единственное место правил «событие/переход → звук». */
export class MatchSfx {
  private engine: ISfxEngine
  constructor(engine: ISfxEngine) { this.engine = engine }

  /** Боёвка — из общего пути событий (host: emit; client: applyEvent). posOf даёт мир-позицию игрока. */
  combat(e: MatchEvent, posOf: (id: number) => THREE.Vector3 | null): void {
    switch (e.t) {
      case 'fired':   { const p = posOf(e.id);     if (p) this.engine.playAt('beam_fire', p); break }
      case 'block':   { const p = posOf(e.victim); if (p) this.engine.playAt('block', p);     break }
      case 'kill':    { const p = posOf(e.victim); if (p) this.engine.playAt('death', p);      break }
      case 'respawn': { this.engine.playAt('respawn', new THREE.Vector3(e.pos[0], e.pos[1], e.pos[2])); break }
      default: break
    }
  }

  /** Свой выстрел (клиент, предсказание) — позиционно у себя. */
  playAtSelf(player: { position: THREE.Vector3 }): void { this.engine.playAt('beam_fire', player.position) }
}
