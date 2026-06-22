export type Role = 'bass' | 'kicks' | 'lead' | 'sfx'
export const ROLES: readonly Role[] = ['bass', 'kicks', 'lead', 'sfx']

/** A single stem: stable id (`role/name`) + asset URL. */
export interface StemRef { id: string; url: string }
export type StemLibrary = Record<Role, StemRef[]>

/** A single voice playing on the current loop. */
export interface VoiceSpec { role: Role; stemId: string; gain: number }
/** Set of voices per loop — the composition result. */
export type Arrangement = VoiceSpec[]

/** Playback engine (DIP boundary: real Web Audio OR fake in tests). */
export interface IMusicEngine {
  load(library: StemLibrary): Promise<void>
  /** Starts the scheduler; provider yields an arrangement for each loopIndex. fadeInSec — master fade-in length. */
  start(provider: (loopIndex: number) => Arrangement, fadeInSec?: number): Promise<void>
  /** Smoothly fades music out (master → 0) and stops the scheduler — on match end. */
  fadeOut(): void
  stop(): void
  setMasterGain(gain: number): void
  dispose(): void
  /** Index of the last scheduled loop (for debug/e2e). */
  readonly loopIndex: number
  /** Active stemIds on the current loop (for debug/e2e). */
  activeStemIds(): string[]
  /** Current RMS level 0..1 (for audio visualization). */
  readLevel(): number
  /** Fills out[] with the spectrum (max-combining) — for frequency visualization. */
  readBands(out: Float32Array): void
}
