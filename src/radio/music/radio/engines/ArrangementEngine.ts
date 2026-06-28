import type { Rng } from '../../seededRandom'
import { weightedPick, type Weighted } from '../weighted'
import type { LayerFlags, SectionName } from '../MusicalState'
import type { MoodConfig } from '../banks'

export interface SectionPlan { section: SectionName; layers: LayerFlags; isFirst: boolean }

export class ArrangementEngine {
  private started = false

  next(mood: MoodConfig, rng: Rng): SectionPlan {
    if (!this.started) {
      this.started = true
      return { section: 'intro', layers: this.layers(mood, rng, 'intro'), isFirst: true }
    }
    const w = mood.arrangementWeights
    const section = weightedPick<SectionName>(rng, [
      ['A', w.A], ['A_prime', w.A_prime], ['break', w.break], ['B', w.B],
    ] as Weighted<SectionName>[])
    return { section, layers: this.layers(mood, rng, section), isFirst: false }
  }

  /** Layers fade in/out per mood probabilities; kicks/bass always present except in break. */
  private layers(mood: MoodConfig, rng: Rng, section: SectionName): LayerFlags {
    const lp = mood.layerProbabilities
    const isBreak = section === 'break'
    const isIntro = section === 'intro'
    return {
      kicks: !isBreak,
      bass: !isIntro,
      lead: !isBreak && rng.next() < lp.lead,
      bg: rng.next() < lp.atmosphere,
      perc: !isBreak && rng.next() < lp.perc,
    }
  }
}
