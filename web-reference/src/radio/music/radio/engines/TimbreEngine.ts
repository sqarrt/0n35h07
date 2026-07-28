import type { Rng } from '../../seededRandom'
import type { InstrumentConfig, InstrumentsBank, MoodConfig, Range } from '../banks'

export interface DriftState { lpf: number; room: number; gain: number; acidenv: number }

const GAIN_RANGE: Range = [0.5, 1.0]
const ACIDENV_RANGE: Range = [0.4, 0.8] // bass filter-env squelch, evolves slowly
const DRIFT_STEP = 0.05 // fraction of each range per tick

function mid(r: Range): number { return (r[0] + r[1]) / 2 }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }

function walk(value: number, range: Range, rng: Rng): number {
  const span = range[1] - range[0]
  const next = value + (rng.next() - 0.5) * 2 * DRIFT_STEP * span
  return clamp(next, range[0], range[1])
}

export function initialDrift(mood: MoodConfig): DriftState {
  return {
    lpf: mid(mood.fx.lpfRange), room: mid(mood.fx.roomRange),
    gain: mid(GAIN_RANGE), acidenv: mid(ACIDENV_RANGE),
  }
}

export class TimbreEngine {
  private readonly instruments: InstrumentsBank
  constructor(banks: { instruments: InstrumentsBank }) { this.instruments = banks.instruments }

  chooseInstrument(name: string): InstrumentConfig {
    const inst = this.instruments[name]
    if (!inst) throw new Error(`unknown instrument: ${name}`)
    return inst
  }

  /** Slow clamped random walk on lpf/room/gain — the "breathing" of the mix. */
  drift(mood: MoodConfig, rng: Rng, state: DriftState): DriftState {
    return {
      lpf: walk(state.lpf, mood.fx.lpfRange, rng),
      room: walk(state.room, mood.fx.roomRange, rng),
      gain: walk(state.gain, GAIN_RANGE, rng),
      acidenv: walk(state.acidenv, ACIDENV_RANGE, rng),
    }
  }
}
