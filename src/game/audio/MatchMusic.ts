import type { IMusicEngine } from './types'
import { STEM_LIBRARY } from './stems'
import { MusicDirector } from './MusicDirector'
import { hashSeed } from './rng'

/** Binds the seed (from the room code) + director to the engine; owns the match music lifecycle.
 *  Asks the match for the remaining match time (for the outro) via getRemainingMs — it's in sync across peers. */
export class MatchMusic {
  private readonly seed: number
  private readonly engine: IMusicEngine
  private readonly getRemainingMs: () => number
  private readonly director = new MusicDirector()
  private started = false

  constructor(seedCode: string, engine: IMusicEngine, getRemainingMs: () => number) {
    this.engine = engine
    this.getRemainingMs = getRemainingMs
    this.seed = hashSeed(seedCode)
  }

  /** Starts once on entering the match (countdown/live). Idempotent.
   *  __debugMusic is set HERE, not in the constructor: useMemo in Game under React.StrictMode
   *  instantiates Match (and the engine) twice, but start() is called only on the committed one — otherwise
   *  the global would point at a discarded engine that never scheduled loops. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    const engine = this.engine
    window.__debugMusic = () => ({ loopIndex: engine.loopIndex, active: engine.activeStemIds() })
    await engine.load(STEM_LIBRARY)
    await engine.start(loopIndex => this.director.compose(this.seed, loopIndex, STEM_LIBRARY, this.getRemainingMs()))
  }

  /** Fades the music out at match end. Safe to call before start (no-op). */
  fadeOut(): void {
    if (this.started) this.engine.fadeOut()
  }

  dispose(): void {
    this.engine.dispose()
    delete window.__debugMusic
  }
}
