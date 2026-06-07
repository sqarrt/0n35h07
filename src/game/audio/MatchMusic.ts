import type { IMusicEngine } from './types'
import { STEM_LIBRARY } from './stems'
import { MusicDirector } from './MusicDirector'
import { hashSeed } from './rng'

/** Связывает сид (из лобби-кода) + директора с движком; владеет жизненным циклом музыки матча. */
export class MatchMusic {
  private readonly seed: number
  private readonly engine: IMusicEngine
  private readonly director = new MusicDirector()
  private started = false

  constructor(seedCode: string, engine: IMusicEngine) {
    this.engine = engine
    this.seed = hashSeed(seedCode)
    window.__debugMusic = () => ({ loopIndex: engine.loopIndex, active: engine.activeStemIds() })
  }

  /** Заводится один раз на переходе матча в live. Идемпотентно. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(STEM_LIBRARY)
    await this.engine.start(loopIndex => this.director.compose(this.seed, loopIndex, STEM_LIBRARY))
  }

  dispose(): void {
    this.engine.dispose()
    delete window.__debugMusic
  }
}
