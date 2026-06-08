import * as THREE from 'three'
import type { ISfxEngine } from './types'
import type { MatchEvent } from '../../../net/protocol'

export type MoveKind = 'jump' | 'land'

/** Снимок состояния игрока за кадр для перклички переходов. */
export interface PlayerSfxInput {
  id: number
  obj: THREE.Object3D
  pos: THREE.Vector3
  shieldActive: boolean
  dashing: boolean
  grounded: boolean | null      // null = неизвестно (удалённый на клиенте) → jump/land приходят событием
  justJumped: boolean
  dashReady: boolean | null     // не-null только для локального игрока (cooldown_ready)
  shieldReady: boolean | null
}

interface PrevState { shield: boolean; dashing: boolean; grounded: boolean | null; dashReady: boolean; shieldReady: boolean }

/** Логика триггеров SFX матча. Единственное место правил «событие/переход → звук». */
export class MatchSfx {
  private engine: ISfxEngine
  private prev = new Map<number, PrevState>()
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

  /** Перекличка состояний за кадр: щит/рывок/прыжок/land/cooldown. Возвращает движения для эмита (host). */
  frame(inputs: PlayerSfxInput[]): { id: number; kind: MoveKind; pos: THREE.Vector3 }[] {
    const moves: { id: number; kind: MoveKind; pos: THREE.Vector3 }[] = []
    for (const inp of inputs) {
      const prev = this.prev.get(inp.id)
      if (inp.shieldActive && !(prev?.shield)) {
        this.engine.playAt('shield_up', inp.pos)
        this.engine.startLoop('shield_loop', `shield:${inp.id}`, inp.obj)
      } else if (!inp.shieldActive && prev?.shield) {
        this.engine.playAt('shield_down', inp.pos)
        this.engine.stopLoop(`shield:${inp.id}`)
      }
      if (inp.dashing && !(prev?.dashing)) this.engine.playAt('dash', inp.pos)
      if (inp.justJumped) { this.engine.playAt('jump', inp.pos); moves.push({ id: inp.id, kind: 'jump', pos: inp.pos.clone() }) }
      if (inp.grounded === true && prev?.grounded === false) { this.engine.playAt('land', inp.pos); moves.push({ id: inp.id, kind: 'land', pos: inp.pos.clone() }) }
      if (inp.dashReady !== null && inp.shieldReady !== null && prev) {
        if ((inp.dashReady && !prev.dashReady) || (inp.shieldReady && !prev.shieldReady)) this.engine.play2D('cooldown_ready')
      }
      this.prev.set(inp.id, {
        shield: inp.shieldActive, dashing: inp.dashing, grounded: inp.grounded,
        dashReady: inp.dashReady ?? true, shieldReady: inp.shieldReady ?? true,
      })
    }
    return moves
  }

  /** Прыжок/приземление соперника (клиент, событие move) — позиционно. */
  move(kind: MoveKind, pos: THREE.Vector3): void { this.engine.playAt(kind, pos) }

  /** Непозиционный звук матча (отсчёт). */
  play2D(event: Parameters<ISfxEngine['play2D']>[0]): void { this.engine.play2D(event) }

  /** Очистка лупов/состояния (конец матча). */
  reset(): void {
    for (const id of this.prev.keys()) this.engine.stopLoop(`shield:${id}`)
    this.prev.clear()
  }
}
