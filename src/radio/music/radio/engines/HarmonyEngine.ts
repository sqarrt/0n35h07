import type { Rng } from '../../seededRandom'
import { weightedPick, type Weighted } from '../weighted'
import { AntiRepeatBuffer } from '../AntiRepeatBuffer'
import { buildChord, keyRootMidi, voiceLead, type Chord, type ChordSequence } from '../theory'
import type { MoodConfig, ProgressionsBank, ScalesBank } from '../banks'
import type { BiasProvider } from '../../../bias'

export interface Tonality { key: string; scaleName: string; scale: number[] }

export class HarmonyEngine {
  private readonly progressions: ProgressionsBank
  private readonly scales: ScalesBank

  constructor(banks: { progressions: ProgressionsBank; scales: ScalesBank }) {
    this.progressions = banks.progressions
    this.scales = banks.scales
  }

  chooseTonality(mood: MoodConfig, rng: Rng, anti: AntiRepeatBuffer, bias?: BiasProvider): Tonality {
    const keyOptions: Weighted<string>[] = mood.preferredKeys.map((k) => [k, bias?.weightFor('key', k) ?? 1])
    const scaleOptions: Weighted<string>[] = mood.preferredScales.map((s) => [s, bias?.weightFor('scale', s) ?? 1])
    const key = weightedPick(rng, anti.penalize('key', keyOptions))
    const scaleName = weightedPick(rng, anti.penalize('scale', scaleOptions))
    anti.record('key', key)
    anti.record('scale', scaleName)
    return { key, scaleName, scale: this.scales[scaleName] }
  }

  /** Pick a progression (markov graph or preset by mood.graphMode) and voice it. */
  buildSequence(
    mood: MoodConfig, tonality: Tonality, lengthBars: number,
    rng: Rng, anti: AntiRepeatBuffer, prevMeanMidi: number | null,
  ): ChordSequence {
    const romans = rng.next() < mood.graphMode
      ? this.walkGraph(rng, lengthBars)
      : this.pickPreset(rng, anti)

    const rootMidi = keyRootMidi(tonality.key)
    const per = Math.max(1, Math.floor(lengthBars / romans.length))
    const seq: ChordSequence = []
    let mean = prevMeanMidi
    let barsLeft = lengthBars
    romans.forEach((roman, i) => {
      const dur = i === romans.length - 1 ? barsLeft : Math.min(per, barsLeft)
      barsLeft -= dur
      const ext = this.pickExtension(rng)
      const base: Chord = buildChord(rootMidi, tonality.scale, roman, ext, dur)
      const voiced = voiceLead(base.notes, mean)
      mean = voiced.reduce((a, b) => a + b, 0) / voiced.length
      seq.push({ ...base, notes: voiced })
    })
    return seq
  }

  private pickExtension(rng: Rng): '' | '7' | '9' {
    return weightedPick(rng, [['', 5], ['7', 3], ['9', 1]] as const)
  }

  private pickPreset(rng: Rng, anti: AntiRepeatBuffer): string[] {
    const presets = this.progressions.presets
    const options: Weighted<number>[] = presets.map((_, i) => [i, 1])
    const idx = weightedPick(rng, anti.penalize('preset', options.map(([i, w]) => [String(i), w]))
      .map(([s, w]) => [Number(s), w] as Weighted<number>))
    anti.record('preset', String(idx))
    return presets[idx]
  }

  private walkGraph(rng: Rng, lengthBars: number): string[] {
    const graph = this.progressions.graph
    const nodes = Object.keys(graph)
    const start = nodes.includes('i') ? 'i' : nodes[0]
    const steps = Math.max(2, Math.min(8, Math.round(lengthBars / 2)))
    const out: string[] = [start]
    let cur = start
    for (let i = 1; i < steps; i++) {
      const edges = graph[cur]
      if (!edges || edges.length === 0) break
      cur = weightedPick(rng, edges)
      out.push(cur)
    }
    return out
  }
}
