// Playback abstraction. The MusicDirector depends only on this interface, never
// on Strudel itself (Dependency Inversion) — so the same director logic can later
// drive a WAV-based engine inside the game.
export interface IStrudelEngine {
  /** Boot the audio backend and register the helper prelude. Idempotent. */
  init(): Promise<void>
  /** Evaluate a full Strudel program (sets tempo/scale + a stack pattern) and play it. */
  play(code: string): Promise<void>
  /** Stop all playback. */
  stop(): void
  /** Master volume, 0..1. Applied live. */
  setVolume(volume: number): void
  readonly isReady: boolean
}
