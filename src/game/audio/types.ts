export type Role = 'bass' | 'kicks' | 'lead' | 'sfx'
export const ROLES: readonly Role[] = ['bass', 'kicks', 'lead', 'sfx']

/** Один стем: стабильный id (`role/name`) + URL ассета. */
export interface StemRef { id: string; url: string }
export type StemLibrary = Record<Role, StemRef[]>

/** Один звучащий голос на текущем лупе. */
export interface VoiceSpec { role: Role; stemId: string; gain: number }
/** Набор голосов на луп — результат композиции. */
export type Arrangement = VoiceSpec[]

/** Движок воспроизведения (DIP-граница: реальный Web Audio ИЛИ фейк в тестах). */
export interface IMusicEngine {
  load(library: StemLibrary): Promise<void>
  /** Запускает планировщик; provider даёт аранжировку для каждого loopIndex. fadeInSec — длина фейд-ина мастера. */
  start(provider: (loopIndex: number) => Arrangement, fadeInSec?: number): Promise<void>
  /** Плавно гасит музыку (мастер → 0) и останавливает планировщик — на завершении матча. */
  fadeOut(): void
  stop(): void
  setMasterGain(gain: number): void
  dispose(): void
  /** Индекс последнего запланированного лупа (для дебага/e2e). */
  readonly loopIndex: number
  /** Активные stemId на текущем лупе (для дебага/e2e). */
  activeStemIds(): string[]
  /** Текущий RMS-уровень 0..1 (для визуализации звука). */
  readLevel(): number
}
