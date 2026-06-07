import type { IMusicEngine, MusicSection } from './types'
import { STEM_LIBRARY } from './stems'
import { MusicDirector } from './MusicDirector'
import { hashSeed } from './rng'

/** Связывает сид (из лобби-кода) + директора с движком; владеет жизненным циклом музыки матча.
 *  Секцию (intro/full/finale) на каждом лупе спрашивает у матча через getSection — она зависит
 *  от состояния боя (первое убийство, остаток времени), синхронного у обоих пиров. */
export class MatchMusic {
  private readonly seed: number
  private readonly engine: IMusicEngine
  private readonly getSection: () => MusicSection
  private readonly director = new MusicDirector()
  private started = false

  constructor(seedCode: string, engine: IMusicEngine, getSection: () => MusicSection) {
    this.engine = engine
    this.getSection = getSection
    this.seed = hashSeed(seedCode)
  }

  /** Заводится один раз на входе в бой (countdown/live). Идемпотентно.
   *  __debugMusic ставится ЗДЕСЬ, а не в конструкторе: useMemo в Game под React.StrictMode
   *  дважды инстанцирует Match (и движок), но start() зовётся только у закоммиченного — иначе
   *  глобал указывал бы на выброшенный движок, который никогда не планировал лупы. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    const engine = this.engine
    window.__debugMusic = () => ({ loopIndex: engine.loopIndex, active: engine.activeStemIds() })
    await engine.load(STEM_LIBRARY)
    await engine.start(loopIndex => this.director.compose(this.seed, loopIndex, STEM_LIBRARY, this.getSection()))
  }

  /** Плавно гасит музыку на завершении матча. Безопасно звать до старта (no-op). */
  fadeOut(): void {
    if (this.started) this.engine.fadeOut()
  }

  dispose(): void {
    this.engine.dispose()
    delete window.__debugMusic
  }
}
