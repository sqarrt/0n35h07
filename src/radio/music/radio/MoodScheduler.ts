import type { Rng } from '../seededRandom'
import { weightedPick, type Weighted } from './weighted'
import { AntiRepeatBuffer } from './AntiRepeatBuffer'
import type { MoodsBank } from './banks'
import type { RadioConfig } from './radioConfig'

/** Decides which mood is active and rotates it every `moodRotationSections`. */
export class MoodScheduler {
  private readonly moods: MoodsBank
  private readonly rotation: number
  private currentMood: string
  private counter = 0

  constructor(banks: { moods: MoodsBank }, config: RadioConfig) {
    this.moods = banks.moods
    this.rotation = Math.max(1, config.moodRotationSections)
    this.currentMood = Object.keys(this.moods)[0]
  }

  current(): string { return this.currentMood }

  sectionsUntilRotation(): number { return this.rotation - this.counter }

  /** Advance one section; rotate to a fresh mood (anti-repeat) when due. */
  tick(rng: Rng, anti: AntiRepeatBuffer): void {
    this.counter++
    if (this.counter >= this.rotation) {
      this.counter = 0
      this.currentMood = this.pickNextMood(rng, anti)
      anti.record('mood', this.currentMood)
    }
  }

  private pickNextMood(rng: Rng, anti: AntiRepeatBuffer): string {
    const names = Object.keys(this.moods)
    const options: Weighted<string>[] = names.map((n) => [n, n === this.currentMood ? 0.001 : 1])
    return weightedPick(rng, anti.penalize('mood', options))
  }
}
