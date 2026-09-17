import type { Rng } from '../../seededRandom'
import { weightedPick, type Weighted } from '../weighted'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import type { DrumsBank, MoodConfig } from '../banks'

export interface DrumPattern {
  kit: string; kick: string; snare: string; hh: string
  /** Deterministic per-step gain mini-notation, e.g. "0.95 0.8 1 0.85". */
  gain: string
  swing: number
}

const HUMANIZE_STEPS = 8

export class RhythmEngine {
  private readonly drums: DrumsBank
  constructor(banks: { drums: DrumsBank }) { this.drums = banks.drums }

  chooseKit(mood: MoodConfig, rng: Rng, anti: AntiRepeatBuffer): string {
    const options: Weighted<string>[] = mood.drumKits.map((k) => [k, 1])
    const kit = weightedPick(rng, anti.penalize('kit', options))
    anti.record('kit', kit)
    return kit
  }

  buildDrums(kit: string, mood: MoodConfig, rng: Rng, opts: { fill: boolean }): DrumPattern {
    const k = this.drums[kit]
    if (!k) throw new Error(`unknown drum kit: ${kit}`)
    const kick = opts.fill
      ? weightedPick(rng, k.fills.map((p) => [p, 1] as Weighted<string>))
      : weightedPick(rng, k.kick.map((p) => [p, 1] as Weighted<string>))
    const snare = weightedPick(rng, k.snare.map((p) => [p, 1] as Weighted<string>))
    const hh = weightedPick(rng, k.hh.map((p) => [p, 1] as Weighted<string>))
    return { kit, kick, snare, hh, gain: this.humanizedGain(rng), swing: mood.swing }
  }

  /** Deterministic gain jitter around 0.9 (±0.1), rounded to 2 decimals. */
  private humanizedGain(rng: Rng): string {
    const steps: string[] = []
    for (let i = 0; i < HUMANIZE_STEPS; i++) {
      const g = 0.9 + (rng.next() - 0.5) * 0.2
      steps.push((Math.round(g * 100) / 100).toString())
    }
    return steps.join(' ')
  }
}
