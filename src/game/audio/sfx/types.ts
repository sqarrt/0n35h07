import type * as THREE from 'three'

/** SFX event id = filename without extension. */
export type SfxEvent =
  | 'beam_fire' | 'beam_fire_rage' | 'beam_fire_singularity' | 'block' | 'shield_up' | 'shield_down' | 'cooldown_ready'
  | 'dash' | 'jump' | 'land' | 'death' | 'respawn'
  | 'ui_click' | 'ui_hover' | 'ui_toggle' | 'ready' | 'room_join' | 'count_tick' | 'go'
  | 'catalyst' | 'double_kill' | 'triple_kill' | 'singularity'
  | 'shield_loop' | 'ghost_loop'

/** SFX engine (DIP boundary: real three-audio OR fake in tests). */
export interface ISfxEngine {
  load(): Promise<void>
  /** On match entry: listener onto camera, parent (match.root) for positional nodes. */
  attach(camera: THREE.Camera, parent: THREE.Object3D): void
  detach(): void
  playAt(event: SfxEvent, pos: THREE.Vector3, gain?: number): void
  play2D(event: SfxEvent, gain?: number): void
  has(event: SfxEvent): boolean   // event buffer loaded? (fallback while asset is missing)
  startLoop(event: SfxEvent, key: string, target: THREE.Object3D | null): void   // null → 2D loop (own player)
  stopLoop(key: string): void
  setMasterGain(gain: number): void
  dispose(): void
}
