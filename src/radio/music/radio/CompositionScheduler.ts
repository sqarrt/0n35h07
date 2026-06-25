import { createRng, type Rng } from '../seededRandom'
import { weightedPick, type Weighted } from './weighted'
import { AntiRepeatBuffer } from './AntiRepeatBuffer'
import { HarmonyEngine, type Tonality } from './engines/HarmonyEngine'
import { buildArc, type SectionRole } from './arrangement'
import { chooseStyle, type TrackStyle } from './trackStyle'
import type { ChordSequence } from './theory'
import type { MoodConfig, RadioBanks } from './banks'
import type { RadioConfig } from './radioConfig'
import type { TrackDescriptor } from '../../trackDescriptor'

export interface TrackPlan {
  index: number
  seed: string
  mood: string
  tonality: Tonality
  bpm: number
  sectionsPerTrack: number
  /** Energy-arc role for each section of the track (length sectionsPerTrack). */
  arc: SectionRole[]
  /** Per-track synth/drum identity (timbre + rhythm), fixed for the whole track. */
  style: TrackStyle
  /** ONE chord progression shared by every section — the track's harmonic identity. */
  progression: ChordSequence
}

/** Owns the track loop: each track fixes mood/key/bpm and runs its own RNG. */
export class CompositionScheduler {
  private readonly banks: RadioBanks
  private readonly sessionSeed: string
  private readonly harmony: HarmonyEngine
  private readonly anti: AntiRepeatBuffer
  private trackIndex = 0
  private sectionPos = 0
  private plan: TrackPlan
  private trackRng: Rng

  constructor(deps: { banks: RadioBanks; config: RadioConfig; sessionSeed: string }) {
    this.banks = deps.banks
    this.sessionSeed = deps.sessionSeed
    this.harmony = new HarmonyEngine(this.banks)
    this.anti = new AntiRepeatBuffer(deps.config.antiRepeatWindow)
    this.trackRng = createRng(`${this.sessionSeed}:t0`)
    this.plan = this.buildTrack(0, this.trackRng)
  }

  current(): TrackPlan { return this.plan }
  rng(): Rng { return this.trackRng }
  sectionInTrack(): number { return this.sectionPos }
  isTrackStart(): boolean { return this.sectionPos === 0 }
  currentIndex(): number { return this.trackIndex }

  /** Compact, comparable identity of the current track (for favorites + like/dislike bias). */
  descriptor(): TrackDescriptor {
    const p = this.plan
    const kv = p.style.kickVoice
    return {
      seed: p.seed, index: p.index, mood: p.mood, key: p.tonality.key, scaleName: p.tonality.scaleName, bpm: p.bpm,
      style: { kick: `${kv.bank ?? ''}:${kv.n}`, bass: p.style.bassSound, lead: p.style.leadSound, bg: p.style.bg, perc: p.style.perc },
    }
  }

  /** Jump to an explicit track index (deterministic — rebuilds that track's plan from its seed). */
  jumpTo(index: number): void {
    this.trackIndex = Math.max(0, Math.floor(index))
    this.sectionPos = 0
    this.trackRng = createRng(`${this.sessionSeed}:t${this.trackIndex}`)
    this.plan = this.buildTrack(this.trackIndex, this.trackRng)
  }

  tick(): void {
    this.sectionPos++
    if (this.sectionPos >= this.plan.sectionsPerTrack) {
      this.trackIndex++
      this.sectionPos = 0
      this.trackRng = createRng(`${this.sessionSeed}:t${this.trackIndex}`)
      this.plan = this.buildTrack(this.trackIndex, this.trackRng)
    }
  }

  private buildTrack(index: number, rng: Rng): TrackPlan {
    const moodNames = Object.keys(this.banks.moods)
    // Every track (including the first) picks its mood by rng with anti-repeat, so
    // different seeds open on different moods — not always the first one in the bank.
    const mood = weightedPick(rng, this.anti.penalize('mood', moodNames.map((n) => [n, 1] as Weighted<string>)))
    this.anti.record('mood', mood)
    const m: MoodConfig = this.banks.moods[mood]
    const tonality = this.harmony.chooseTonality(m, rng, this.anti)
    const [lo, hi] = m.bpmRange
    const bpm = Math.round(lo + rng.next() * (hi - lo))
    const arc = buildArc(rng, m.density < 0.5) // energy graph; deep moods get a gentler one
    const spt = arc.length                     // the arc defines the track's length
    const style = chooseStyle(rng, this.anti)
    // ONE 4-chord progression for the whole track — its harmonic identity.
    const progression = this.harmony.buildSequence(m, tonality, 4, rng, this.anti, null)
    return {
      index, seed: `${this.sessionSeed}:t${index}`, mood, tonality, bpm,
      sectionsPerTrack: spt, arc, style, progression,
    }
  }
}
