import * as THREE from 'three'
import { RESPAWN_GHOST_MS, BODY_MESH_Y } from '../../../constants'
import { AfterimageTrail } from '../AfterimageTrail'
import type { IRespawnFx, RespawnTarget, RespawnFrame } from './types'

// «Хаос»: помехи. Смерть — разрыв; призрак — дёргающийся мерцающий меш; возрождение — глитч-сборка.
// ВАЖНО: дёргается только МЕШ (визуал) — физика/сетевая позиция не затронуты.
const JITTER_MAX = 0.16          // максимум смещения меша от базы (мировые ед.)
// Позиционный джиттер — быстрый (это не стробоскоп: яркость не мигает, дёргается только меш).
const JITTER_INTERVAL_MS = 40
const BREAK_MS = 250             // первые мс призрака — «разрыв»: усиленный джиттер
const BREAK_AMP = 2.5            // множитель амплитуды разрыва
const GHOST_OPACITY_HI = 0.4     // мерцание призрака между двумя уровнями
const GHOST_OPACITY_LO = 0.15
// Яркостное мерцание ограничено отдельно (фоточувствительность ≤ ~9 Гц).
const FLICKER_INTERVAL_MS = 110
const FLICKER_CHANCE = 0.35      // вероятность «провала» прозрачности на тике мерцания
const REBIRTH_MS = 450           // окно глитч-сборки
const REBIRTH_STEPS = 4          // ступени прозрачности сборки (REBIRTH_OPACITY_FROM → 1)
const REBIRTH_OPACITY_FROM = 0.4

/** Стиль «хаос»: цифровые помехи вместо плавного призрака.
 *  След призрака — СОБСТВЕННЫЙ классический AfterimageTrail (каждая стратегия владеет своим). */
export class ChaosRespawnFx implements IRespawnFx {
  readonly object3d = new THREE.Group()
  private ghostTrail: AfterimageTrail
  private trailEye = new THREE.Vector3()   // scratch: AfterimageTrail ждёт позицию ГЛАЗ, origin — центр шара
  private jitter = new THREE.Vector3()
  private jitterTimer = 0
  private flickerTimer = 0
  private flickerLow = false
  private basePos = new THREE.Vector3()
  private baseSaved = false
  private dirty = false                    // меш смещён/скрыт — нужно восстановление на выходе

  constructor(color: string) {             // цвет — для следа призрака (сам эффект помех бесцветный)
    this.ghostTrail = new AfterimageTrail(new THREE.Color(color))
    this.object3d.add(this.ghostTrail.object3d)
  }

  onDeath(_pos: THREE.Vector3): void {
    this.jitterTimer = 0                   // разрыв начинается мгновенно
  }

  apply(dt: number, t: RespawnTarget, f: RespawnFrame): void {
    // Собственный след призрака (трейл сам смещает позицию глаз к центру шара).
    this.trailEye.copy(f.origin)
    this.trailEye.y -= BODY_MESH_Y
    this.ghostTrail.update(dt, { position: this.trailEye, dashing: f.ghost !== null && f.visible })

    if (f.ghost !== null) {
      this.saveBase(t)
      this.jitterTimer -= dt * 1000
      if (this.jitterTimer <= 0) {
        this.jitterTimer = JITTER_INTERVAL_MS
        const amp = JITTER_MAX * (this.isBreakPhase(f.ghost) ? BREAK_AMP : 1)
        this.jitter.set((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp)
      }
      this.flickerTimer -= dt * 1000
      if (this.flickerTimer <= 0) {
        this.flickerTimer = FLICKER_INTERVAL_MS
        this.flickerLow = Math.random() < FLICKER_CHANCE
      }
      t.mesh.position.copy(this.basePos).add(this.jitter)
      t.mesh.scale.setScalar(1)
      t.setOpacity(this.flickerLow ? GHOST_OPACITY_LO : GHOST_OPACITY_HI)
      t.material.color.copy(f.baseColor)
      this.dirty = true
      return
    }
    if (this.isRebirthActive(f.sinceRebirthMs)) {
      this.saveBase(t)
      const k = f.sinceRebirthMs / REBIRTH_MS                   // 0→1
      const step = Math.min(REBIRTH_STEPS - 1, Math.floor(k * REBIRTH_STEPS))
      const level = REBIRTH_OPACITY_FROM + (1 - REBIRTH_OPACITY_FROM) * (step / (REBIRTH_STEPS - 1))
      // Смещение затухает к нулю вместе со ступенями прозрачности.
      t.mesh.position.copy(this.basePos).addScaledVector(this.jitter, 1 - k)
      t.setOpacity(level)
      t.material.color.copy(f.baseColor)
      this.dirty = true
      return
    }
    if (this.dirty) {                       // первый кадр вне фаз — восстановить нейтраль
      t.mesh.position.copy(this.basePos)
      t.mesh.visible = f.visible
      t.setOpacity(1)
      this.dirty = false
      this.baseSaved = false
    }
  }

  /** «Разрыв» — самое начало призрака (остаток ghost близок к 1): первые BREAK_MS полной фазы. */
  private isBreakPhase(ghost: number): boolean {
    return ghost > 1 - BREAK_MS / RESPAWN_GHOST_MS
  }

  private saveBase(t: RespawnTarget) {
    if (this.baseSaved) return
    this.basePos.copy(t.mesh.position)
    this.baseSaved = true
  }

  isRebirthActive(sinceRebirthMs: number): boolean {
    return sinceRebirthMs >= 0 && sinceRebirthMs < REBIRTH_MS
  }

  update(_dt: number): void {}
  dispose(): void { this.ghostTrail.dispose() }
}
