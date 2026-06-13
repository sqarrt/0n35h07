import type * as THREE from 'three'

/** id события SFX = имя файла без расширения. */
export type SfxEvent =
  | 'beam_fire' | 'beam_fire_rage' | 'beam_fire_singularity' | 'block' | 'shield_up' | 'shield_down' | 'cooldown_ready'
  | 'dash' | 'jump' | 'land' | 'death' | 'respawn'
  | 'ui_click' | 'ui_hover' | 'ui_toggle' | 'ready' | 'room_join' | 'count_tick' | 'go'
  | 'catalyst' | 'double_kill' | 'triple_kill' | 'singularity'
  | 'shield_loop' | 'ghost_loop'

/** Движок SFX (DIP-граница: реальный three-аудио ИЛИ фейк в тестах). */
export interface ISfxEngine {
  load(): Promise<void>
  /** На входе в матч: listener на камеру, parent (match.root) для позиционных нод. */
  attach(camera: THREE.Camera, parent: THREE.Object3D): void
  detach(): void
  playAt(event: SfxEvent, pos: THREE.Vector3, gain?: number): void
  play2D(event: SfxEvent, gain?: number): void
  has(event: SfxEvent): boolean   // буфер события загружен? (фоллбек, пока ассета нет)
  startLoop(event: SfxEvent, key: string, target: THREE.Object3D | null): void   // null → 2D-луп (свой игрок)
  stopLoop(key: string): void
  setMasterGain(gain: number): void
  dispose(): void
}
