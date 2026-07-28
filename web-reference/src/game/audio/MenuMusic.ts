import type { IMusicEngine, StemLibrary, Arrangement, StemRef } from './types'
import { STEM_LIBRARY } from './stems'
import { mulberry32 } from './rng'

// Menu stems (ids of the form role/name from the full STEM_LIBRARY).
const KICK_ID = 'kicks/sub_long'
const BASS_ID = 'bass/kutting'
const COLOR_IDS = ['lead/crickets_tex', 'lead/lwt_14'] as const

const KICK_GAIN = 1.0
const BASS_GAIN = 0.9
const COLOR_GAIN = 0.5
const COLOR_ON_PROB = 0.25   // per-loop chance to start up an idle color layer
const COLOR_ON_LOOPS = 2     // max consecutive loops for a color layer (no more than two)
const COLOR_REST_LOOPS = 1   // mandatory rest after the on-window (otherwise a layer could run >2 loops)
const BASS_OFF_PROB = 0.25   // per-loop chance to send the bass into a rest (it mostly plays)
const BASS_OFF_LOOPS = 1     // how many loops the bass rests (one)
const BASS_PLAY_LOOPS = 1    // mandatory bass play after a rest (rests don't merge)
const MENU_FADE_IN_SEC = 2.0 // smooth fade-in of the menu music on start (not "full volume at once")
const MENU_FADE_OUT_SEC = 0.6 // quick fade on leaving the menu (entering a match) — gone within ~1s, no echo tail
// Variety (occasional thickening + reverb/echo on the color layers / mix). Driven by a SEPARATE rng so the
// existing bass/color step logic (and its tests) keep their exact random stream.
const MENU_FX_SEED = 0x4d65
const MENU_DOUBLE_PROB = 0.50  // chance a color layer is thickened with a (stereo-spread) doubled copy
const MENU_DOUBLE_MIN = 0.035  // clearly audible doubling/slap offset (kept < 0.1s)
const MENU_DOUBLE_MAX = 0.090
const MENU_REVERB_PROB = 0.40  // chance the loop gets a reverb wash (kicks stay dry)
const MENU_REVERB = 0.20
const MENU_ECHO_PROB = 0.40    // chance a color layer gets a touch of echo
const MENU_ECHO = 0.20

/** Minimal library: only the needed menu stems (by id from the full STEM_LIBRARY). */
function menuLibrary(): StemLibrary {
  const all: StemRef[] = Object.values(STEM_LIBRARY).flat()
  const pick = (id: string) => all.filter(s => s.id === id)
  return {
    kicks: pick(KICK_ID),
    bass: pick(BASS_ID),
    lead: COLOR_IDS.flatMap(id => pick(id)),
    sfx: [],
  }
}

/**
 * Menu background music: foundation (kick `sub_long` + bass `kutting`) every loop,
 * two color layers (`crickets_tex`, `lwt_14`) toggle INDEPENDENTLY and occasionally (can be together/neither).
 * Local (no network sync) → plain RNG; injectable for tests.
 */
export class MenuMusic {
  private readonly engine: IMusicEngine
  private readonly lib: StemLibrary
  private readonly rng: () => number
  private readonly fxRng = mulberry32(MENU_FX_SEED)   // variety stream, independent of the bass/color rng
  private started = false
  private colorOn: number[]    // per color layer: loops remaining in the on-window
  private colorRest: number[]  // per color layer: loops remaining in the mandatory rest after the window
  private bassRest = 0         // loops remaining in the bass rest
  private bassPlay = 0         // loops remaining of the mandatory bass play after a rest

  constructor(engine: IMusicEngine, rng: () => number = Math.random) {
    this.engine = engine
    this.rng = rng
    this.lib = menuLibrary()
    this.colorOn = COLOR_IDS.map(() => 0)
    this.colorRest = COLOR_IDS.map(() => 0)
  }

  /** Preload (decode) buffers — needs no gesture; makes the first gesture-triggered start instant. */
  async preload(): Promise<void> {
    await this.engine.load(this.lib)
  }

  /** Starts the menu music (idempotent). Must be called from a user gesture (autoplay). */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.engine.load(this.lib)
    await this.engine.start(i => this.arrange(i), MENU_FADE_IN_SEC)
  }

  /** Fades out (entering a match / leaving). Safe to call before start. */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.engine.fadeOut({ tailEcho: false, sec: MENU_FADE_OUT_SEC })   // quick, no ring-out — gone within ~1s
    this.colorOn = COLOR_IDS.map(() => 0)
    this.colorRest = COLOR_IDS.map(() => 0)
    this.bassRest = 0
    this.bassPlay = 0
  }

  setVolume(v: number): void { this.engine.setMasterGain(v) }
  /** Current RMS level of the menu music 0..1 (for visualization). */
  readLevel(): number { return this.engine.readLevel() }
  /** Menu music spectrum into out[] (max-combining). */
  readBands(out: Float32Array): void { this.engine.readBands(out) }
  dispose(): void { this.engine.dispose() }

  /** Loop arrangement: kick (constant foundation) + bass (mostly playing, occasionally resting) +
   *  independently "breathing" color layers. */
  arrange(_loopIndex: number): Arrangement {
    const voices: Arrangement = [{ role: 'kicks', stemId: KICK_ID, gain: KICK_GAIN }]
    if (this.stepBass()) voices.push({ role: 'bass', stemId: BASS_ID, gain: BASS_GAIN })
    COLOR_IDS.forEach((id, i) => {
      if (this.stepColor(i)) voices.push({ role: 'lead', stemId: id, gain: COLOR_GAIN })
    })
    this.applyVariety(voices)
    return voices
  }

  /** Occasional thickening + reverb/echo for variety (uses fxRng so the step logic's stream is untouched). */
  private applyVariety(voices: Arrangement): void {
    const r = this.fxRng
    const color = voices.find(v => v.role === 'lead')
    if (color && r() < MENU_DOUBLE_PROB) color.doubleSec = MENU_DOUBLE_MIN + r() * (MENU_DOUBLE_MAX - MENU_DOUBLE_MIN)
    if (r() < MENU_REVERB_PROB) for (const v of voices) if (v.role !== 'kicks') v.reverb = MENU_REVERB   // keep the kick dry
    if (color && r() < MENU_ECHO_PROB) color.echo = MENU_ECHO
  }

  /** Color layer per loop: on-window ≤ COLOR_ON_LOOPS, then a mandatory rest (never runs more than two). */
  private stepColor(i: number): boolean {
    if (this.colorRest[i] > 0) { this.colorRest[i]--; return false }   // mandatory rest after the window
    if (this.colorOn[i] > 0) { this.colorOn[i]--; if (this.colorOn[i] === 0) this.colorRest[i] = COLOR_REST_LOOPS; return true }
    if (this.rng() < COLOR_ON_PROB) {
      this.colorOn[i] = COLOR_ON_LOOPS - 1
      if (this.colorOn[i] === 0) this.colorRest[i] = COLOR_REST_LOOPS   // 1-loop window → rest right away
      return true
    }
    return false
  }

  /** Bass per loop: mostly plays; occasionally rests for BASS_OFF_LOOPS, then a mandatory play (rests don't merge). */
  private stepBass(): boolean {
    if (this.bassPlay > 0) { this.bassPlay--; return true }            // mandatory play after a rest
    if (this.bassRest > 0) { this.bassRest--; if (this.bassRest === 0) this.bassPlay = BASS_PLAY_LOOPS; return false }
    if (this.rng() < BASS_OFF_PROB) {
      this.bassRest = BASS_OFF_LOOPS - 1
      if (this.bassRest === 0) this.bassPlay = BASS_PLAY_LOOPS         // 1-loop rest → mandatory play right away
      return false
    }
    return true
  }
}
