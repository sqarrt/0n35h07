import { createRng, randomSeed } from '../seededRandom'
import type { RadioBanks } from './banks'
import type { RadioConfig } from './radioConfig'
import { AntiRepeatBuffer } from './AntiRepeatBuffer'
import { RhythmEngine } from './engines/RhythmEngine'
import { MelodyEngine, initialLeadState, type LeadState } from './engines/MelodyEngine'
import { BassEngine } from './engines/BassEngine'
import { TimbreEngine, initialDrift, type DriftState } from './engines/TimbreEngine'
import { CompositionScheduler } from './CompositionScheduler'
import { shapeFor, type SectionRole } from './arrangement'
import type { PercKind, BgKind } from './trackStyle'
import { keyRootMidi, type Chord } from './theory'
import type { MusicalState } from './MusicalState'
import type { TrackDescriptor } from '../../trackDescriptor'
import type { BiasProvider } from '../../bias'
import { sidechainGain } from './fx'

export interface RadioComposerDeps { banks: RadioBanks; config: RadioConfig; bias?: BiasProvider }

const ORBIT = { kicks: 2, perc: 3, bass: 4, pad: 5, lead: 6, snare: 7, fx: 8, arp: 9 } as const

// ── GLOBAL MIX ───────────────────────────────────────────────────────────────────────────
// The ONE place the balance of every role is set. These levels are FIXED — they do NOT
// depend on the track, mood or random drift, so the mix sounds the same in every composition
// (only a gentle, uniform section-energy envelope scales them all together). Kick is the loud
// reference; lead sits well under it; bg is near-subliminal.
const MASTER = 0.92
const MIX = {
  kick: 0.9,
  bass: 0.5,
  sub: 0.42,
  lead: 0.12,   // leads sit WELL under the groove (used less than bass, just above bg) — never pierce
  bgScale: 0.42, // multiplies each bg texture's own (already small) level → near-subliminal
  bgCap: 0.085, // HARD ceiling on a bg texture's pre-scale level so the loud ones can't pierce
  hat: 0.34,
  snare: 0.46,
  clap: 0.4,
  perc: 0.3,
  fx: 0.4,      // transition devices / risers / riser texture
} as const

export class RadioComposer {
  private readonly banks: RadioBanks
  private readonly config: RadioConfig
  private readonly anti: AntiRepeatBuffer
  private readonly rhythm: RhythmEngine
  private readonly melody: MelodyEngine
  private readonly bass: BassEngine
  private readonly timbre: TimbreEngine
  private readonly bias?: BiasProvider
  private scheduler: CompositionScheduler
  private seed: string

  private drift: DriftState
  private lead: LeadState = initialLeadState()
  private bar = 0
  private afterBreak = false // true once the track passes its breakdown → 2nd movement
  // Drums (kit SOUND + velocity curve) are LOCKED per track — re-choosing them every
  // section made the kit lurch on every boundary, killing continuity. One kit per track.
  private kitTrackIndex = -1
  private trackDrums: ReturnType<RhythmEngine['buildDrums']> | null = null

  constructor(deps: RadioComposerDeps) {
    this.banks = deps.banks
    this.config = deps.config
    this.seed = deps.config.seed ?? randomSeed()
    this.anti = new AntiRepeatBuffer(deps.config.antiRepeatWindow)
    this.rhythm = new RhythmEngine(this.banks)
    this.melody = new MelodyEngine()
    this.bass = new BassEngine()
    this.timbre = new TimbreEngine(this.banks)
    this.bias = deps.bias
    this.scheduler = new CompositionScheduler({ banks: this.banks, config: deps.config, sessionSeed: this.seed, bias: this.bias })
    this.drift = initialDrift(this.banks.moods[this.scheduler.current().mood])
  }

  /** Current track's compact identity (for favorites + bias). */
  descriptor(): TrackDescriptor { return this.scheduler.descriptor() }
  currentIndex(): number { return this.scheduler.currentIndex() }

  /** Render the CURRENT track's WHOLE arc to a list of sections (code + bars), deterministically.
   *  Advances this composer through the track, so callers use a throwaway instance (see bake). */
  renderTrack(): { code: string; bars: number }[] {
    const startIndex = this.scheduler.currentIndex()
    const sections: { code: string; bars: number }[] = []
    let guard = 0
    while (this.scheduler.currentIndex() === startIndex && guard++ < 64) {
      const { strudelCode, musicalState } = this.buildNextPattern()
      sections.push({ code: strudelCode, bars: musicalState.sectionBars })
    }
    return sections
  }

  /** Jump to a track index within the current session seed (deterministic). Resets per-track state. */
  jumpTo(index: number): void { this.scheduler.jumpTo(index); this.resetTrackState() }

  /** Replay tracks from a DIFFERENT session seed (a saved favorite): rebuild the scheduler, then jumpTo. */
  reseed(seed: string): void {
    this.seed = seed
    this.scheduler = new CompositionScheduler({ banks: this.banks, config: this.config, sessionSeed: seed, bias: this.bias })
    this.resetTrackState()
  }

  /** Reset the composer's per-track mutable state (mirrors the track-start reset in buildNextPattern). */
  private resetTrackState(): void {
    this.lead = initialLeadState()
    this.afterBreak = false
    this.bar = 0
    this.kitTrackIndex = -1
    this.trackDrums = null
    this.drift = initialDrift(this.banks.moods[this.scheduler.current().mood])
  }

  buildNextPattern(): { strudelCode: string; musicalState: MusicalState } {
    const track = this.scheduler.current()
    const mood = this.banks.moods[track.mood]
    const rng = this.scheduler.rng()
    const pos = this.scheduler.sectionInTrack()
    const role: SectionRole = (track.arc[pos] as SectionRole) ?? 'peak'
    const shape = shapeFor(role)
    const bars = shape.bars
    const energy = shape.energy
    const n = bars
    const off = this.bar % n // phase-align block sweeps to this section's start
    // SECTION ALIGNMENT — Strudel patterns run on the GLOBAL cycle clock, so a `<a b c d>` sequence or a `.slow(n)`
    // sweep plays element/phase `globalCycle % len`, NOT element 0 at the section start (sections have varied bar
    // counts, so this.bar % len ≠ 0). That made layers "enter mid-loop" and risers/fills land on the wrong bar.
    // `lateAlign` shifts an n-bar LFO so its phase-0 lands on the section's first bar; `seqAligned` rotates a bar
    // sequence so element 0 lands on the first bar (element p on the section's bar p).
    const lateAlign = off > 0 ? `.late(${off})` : ''
    const seqAligned = (elems: string[]): string => {
      const len = elems.length
      const rot = new Array<string>(len)
      for (let p = 0; p < len; p++) rot[(this.bar + p) % len] = elems[p]
      return `<${rot.join(' ')}>`
    }
    const nextRole = track.arc[pos + 1]
    const fillNext = nextRole === 'break' || nextRole === 'outro' || nextRole === undefined
    const muffled = role === 'intro'
    const memory = role === 'intro' || role === 'break' // atmospheric, echo-drenched

    // Progress THROUGH the current block (a run of meat loops / builds) so parts can
    // EVOLVE over the block — filter opens, acid env moves — instead of looping flat.
    const groupOf = (r?: string) => (r === 'peak' ? 'meat' : r)
    const grp = groupOf(role)
    let bStart = pos
    while (bStart > 0 && groupOf(track.arc[bStart - 1]) === grp) bStart--
    let bEnd = pos
    while (bEnd < track.arc.length - 1 && groupOf(track.arc[bEnd + 1]) === grp) bEnd++
    const blockProgress = bEnd > bStart ? (pos - bStart) / (bEnd - bStart) : 0 // 0..1 across the block
    const lastInBlock = pos === bEnd

    const seq = track.progression
    const chord = seq[0]
    const style = track.style

    // The peak is FULL (kick+bass+lead+perc all on) and must read as the fattest part.
    // Call & response lives as per-BAR dynamics WITHIN the one peak loop (1 cycle = 1 bar),
    // NOT by muting. To keep a long peak block from going stale, the response phase ALTERNATES
    // each loop: even loops are bass-forward (lead answers on bar 4), odd loops are lead-forward
    // (bass holds and re-asserts on bar 4). Floors keep every voice audible — never silent.
    const peak = role === 'peak'
    const leadFwd = peak && (pos - bStart) % 2 === 1
    const bassEmph = !peak ? '' : leadFwd ? `.gain("${seqAligned(['0.85', '0.85', '0.85', '1'])}")` : `.gain("${seqAligned(['1', '1', '1', '0.84'])}")`
    const leadEmph = !peak ? '' : leadFwd ? '' : `.gain("${seqAligned(['0.7', '0.7', '0.7', '1'])}")`

    // EASE-IN — a part that was OFF in the previous section must NOT slam in: ramp its gain
    // over the first ~2 bars so it eases/transitions in (a "pre-lead"). Not only the lead —
    // bass and bg also sound bad appearing abruptly. Continuous parts (on in both sections)
    // are untouched, preserving continuity.
    const prevLayers = pos > 0 ? shapeFor(track.arc[pos - 1] as SectionRole).layers : null
    const entered = (k: keyof typeof shape.layers) => shape.layers[k] && (!prevLayers || !prevLayers[k])
    // A FINE gain ramp (not the old chunky 2-step) for a part that just appeared. The lead does
    // NOT use this — it fades in via a filter open instead, which is smoother still.
    const rampN = Math.min(bars, 4)
    const rampVals = Array.from({ length: rampN }, (_, i) => r2(0.18 + 0.82 * (i + 1) / rampN))
    const easeIn = `.gain("<${rampVals.join(' ')}${bars > rampN ? ` 1!${bars - rampN}` : ''}>")`
    const bassEnter = entered('bass') ? easeIn : ''
    const bgEnter = entered('bg') ? easeIn : ''
    const percEnter = entered('perc') ? easeIn : '' // perc no longer slams in at build→peak

    this.drift = this.timbre.drift(mood, rng, this.drift)
    // Lock the kit + velocity curve for the whole track so the drum SOUND stays put
    // across section boundaries (continuity); a track-stable rng makes it deterministic.
    if (this.kitTrackIndex !== track.index || this.trackDrums === null) {
      const kitRng = createRng(`${track.seed}:kit`)
      this.trackDrums = this.rhythm.buildDrums(this.rhythm.chooseKit(mood, kitRng, this.anti), mood, kitRng, { fill: false })
      this.kitTrackIndex = track.index
    }
    const drums = this.trackDrums

    const bright = 0.4 + 0.6 * energy
    const lpf = Math.round(this.drift.lpf * bright)
    // GLOBAL balance: level = MASTER × role-level × a gentle, UNIFORM section-energy envelope.
    // No drift.gain, no mood.density — so the balance can't shift track-to-track. energyEnv
    // scales every role together (intros softer, peaks fuller) WITHOUT changing their ratios.
    const energyEnv = 0.74 + 0.26 * energy
    const g = (level: number) => r2(MASTER * level * energyEnv)
    const pump = sidechainGain(mood.fx.sidechainDepth)
    // Every part draws echo/reverb from the track's ONE fx space (scaled by role), so
    // parts cohere — no dry bass under a wet lead. dFactor/rFactor = this part's share.
    const fx = style.fx
    const fxFor = (dFactor: number, rFactor: number): string => {
      const dly = r2(Math.min(0.85, fx.delay * dFactor))
      const rm = r2(Math.min(0.85, fx.room * rFactor))
      return (dly > 0.02 ? `.delay(${dly}).delaytime(${fx.delayTime}).delayfeedback(${fx.delayFb})` : '')
        + (rm > 0.02 ? `.room(${rm}).roomsize(${fx.roomSize})` : '')
    }
    // Bass riff is LOCKED per movement; the 2nd movement (after break) gets a new riff.
    const bassRng = createRng(`${track.seed}:bass${this.afterBreak ? '2' : ''}`)

    const layers: string[] = []

    // ── TRANSITIONS — deterministic glue between sections (all 4 families). A "pre"
    //    device fires on the LAST bar of a block (fill/roll/riser/kick-drop/echo-throw);
    //    a "post" impact (crash/sub-drop/downlifter) hits the downbeat we cross INTO.
    const driving = role === 'build' || role === 'peak'
    const boundaryOut = driving && (lastInBlock || fillNext)
    const boundaryIn = driving && pos > 0 && groupOf(track.arc[pos - 1]) !== grp
    const preKinds = ['snareRoll', 'tomRoll', 'riser', 'kickDrop', 'echoThrow'] as const
    const postKinds = ['crash', 'subDrop', 'downlifter'] as const
    const preKind = boundaryOut ? preKinds[createRng(`${track.seed}:tOut${pos}`).int(preKinds.length)] : null
    // Entering a PEAK always slams in with a crash (a downlifter/sub-drop would deflate the
    // drop); other entries (into a build) keep the random impact.
    const postKind = !boundaryIn ? null
      : peak ? 'crash'
      : postKinds[createRng(`${track.seed}:tIn${pos}`).int(postKinds.length)]
    const lastN = Math.max(1, bars - 1)
    const lastBar = (x: string) => seqAligned([...Array(lastN).fill('~'), x])   // value only on the section's FINAL bar
    const firstBar = (x: string) => seqAligned([x, ...Array(lastN).fill('~')])  // value only on the section's FIRST bar

    // ── KICK ──
    if (shape.layers.kicks) {
      const deep = role === 'break' // steady, darker kick that holds the rest together
      const base = mood.density < 0.5 || deep ? 'bd*4' : style.kickPat
      let kickPat = base
      // The fill/drop must land on the section's LAST bar → seqAligned (and `[base]` keeps a multi-token
      // pattern like "bd ~ bd bd" as one bar so the !-repeat can't bind to its last token).
      if (preKind === 'kickDrop') kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~']) // drop the last bar
      else if (boundaryOut) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), fillNext ? '[bd*2 bd bd bd]' : '[bd bd bd bd]'])
      // break: cut the kick on the FINAL bar so the riser/roll peak alone fills the gap.
      else if (deep) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~'])
      // Kick is the loud global reference (drives the whole balance). Composition-independent.
      const kickShape = r2(Math.max(0, (mood.density - 0.45) * 0.45) + (peak ? 0.12 : 0))
      const kickGain = r2(MASTER * MIX.kick * energyEnv * (muffled ? 0.85 : deep ? 0.92 : 1))
      const kickLpf = deep ? '.lpf(1500)' : muffled ? '.lpf(900)' : mood.density < 0.5 ? '.lpf(2200)' : ''
      // per-track kick voice: a drum-machine bank (909/808/…) or a dirt bd variant via .n()
      const kv = style.kickVoice
      const kvoice = (kv.bank ? `.bank("${kv.bank}")` : '') + `.n(${kv.n})`
      layers.push(orbit(`s("${kickPat}")${kvoice}.gain("${drums.gain}").shape(${kickShape}).gain(${kickGain})${kickLpf}`, ORBIT.kicks))
    }

    // pre-device — the last bar of the outgoing section
    if (preKind === 'snareRoll') layers.push(orbit(`s("${lastBar('[sd*4 sd*8]')}").gain(${g(0.52)}).hpf(400).lpf(7000)${fxFor(0, 0.4)}`, ORBIT.snare))
    else if (preKind === 'tomRoll') layers.push(orbit(`s("${lastBar('[lt mt lt mt lt mt lt mt]')}").gain(${g(0.5)}).room(0.2)`, ORBIT.snare))
    else if (preKind === 'riser') layers.push(orbit(`s("${lastBar('white*16')}").dec(0.08).lpf(saw.range(500, 9000)).gain(saw.range(0.04, ${g(0.4)})).hpf(300)`, ORBIT.fx))
    else if (preKind === 'echoThrow') layers.push(orbit(`s("${lastBar('sd')}").gain(${g(0.5)}).delay(0.82).delaytime(0.1875).delayfeedback(0.72).room(0.5).roomsize(6)`, ORBIT.fx))
    else if (preKind === 'kickDrop') layers.push(orbit(`s("${lastBar('white*16')}").dec(0.08).lpf(saw.range(600, 7000)).gain(saw.range(0.03, ${g(0.32)})).hpf(400)`, ORBIT.fx))

    // post-device — the downbeat of the incoming section
    if (postKind === 'crash') layers.push(orbit(`s("${firstBar('white')}").dec(0.6).hpf(3500).gain(${g(0.42)}).room(0.5).roomsize(6)`, ORBIT.fx))
    else if (postKind === 'subDrop') layers.push(orbit(`note("${firstBar('[48 42 36 30 24]')}").s("sine").dec(0.12).lpf(500).gain(${g(0.55)})`, ORBIT.fx))
    else if (postKind === 'downlifter') layers.push(orbit(`s("${firstBar('white*16')}").dec(0.08).lpf(saw.range(9000, 400)).gain(saw.range(${g(0.34)}, 0.03)).hpf(300)`, ORBIT.fx))

    // OUTRO ending: a long, reverberant crash on the final bar so the track concludes
    // with a clear gesture whose tail rings out into the silent gap before the next.
    if (role === 'outro') layers.push(orbit(`s("${lastBar('white')}").dec(1.2).hpf(2500).gain(${g(0.4)}).room(0.6).roomsize(8)`, ORBIT.fx))

    // ── PERC — snares are the "fat" of the peak; light hats keep drive (louder in movement 2)
    if (shape.layers.perc) {
      // breathing hats: decay wobbles via a fast triangle LFO (Switch-Angel detail).
      const hats = `s("${style.hatPat}").dec(tri.fast(4).range(0.05, 0.12)).gain(${g(MIX.hat)})${percEnter}.pan(sine.slow(4))` + (style.swing > 0 ? `.swingBy(${r2(style.swing)}, 4)` : '')
      layers.push(orbit(hats, ORBIT.perc))
      const snPly = peak ? 0.28 : 0.14
      // gentler waveshaper + a lpf so the snare body stays punchy without piercing highs.
      layers.push(orbit(`s("~ sd ~ sd").sometimesBy(${snPly}, x => x.ply(2)).gain(${g(MIX.snare)})${percEnter}${fxFor(0, 0.35)}.shape(${r2(Math.min(0.14, mood.fx.saturation * 0.16))}).lpf(7500)`, ORBIT.snare))
      // peak-only claps on the backbeat (one extra layer, eased in — the ghost-snare layer was
      // dropped to avoid stacking too many things at once).
      if (peak) {
        layers.push(orbit(`s("${style.clapPat}").gain(${g(MIX.clap)})${percEnter}${fxFor(0, 0.3)}.shape(0.08).lpf(7500)`, ORBIT.snare))
      }
      const perc = this.percLayer(style.perc, g)
      if (perc) layers.push(orbit(`${perc}${percEnter}`, ORBIT.perc))
    }

    // ── BASS — locked riff, root follows the progression; clarity sweeps up in intro/build
    if (shape.layers.bass) {
      const roots = seq.map((c) => ((c.notes[0] % 12) + 12) % 12 + 12 * (this.config.bassOctave + 1))
      const groove = style.bassGroove.split(/\s+/).map((t) => t !== '~')
      // acid env never sits still: it WANDERS within the section so the squelch doesn't go
      // stale. HARD-capped at 0.65. The motion shape is chosen per-section (rise / fall /
      // sine / abrupt per-bar jumps) so consecutive sections don't move identically.
      const aRng = createRng(`${track.seed}:aenv${pos}`)
      const center = Math.min(0.6, 0.3 + 0.25 * blockProgress + (this.drift.acidenv - 0.4) * 0.25)
      const amp = muffled ? 0.08 : 0.16
      const aHi = r2(Math.min(0.65, center + amp))
      const aLo = r2(Math.max(0.12, center - amp))
      const motion = (['rise', 'fall', 'sine', 'jump'] as const)[aRng.int(4)]
      let acidenvExpr: string
      if (motion === 'rise') acidenvExpr = `saw.range(${aLo}, ${aHi}).slow(${n}).late(${off})`
      else if (motion === 'fall') acidenvExpr = `saw.range(${aHi}, ${aLo}).slow(${n}).late(${off})`
      else if (motion === 'sine') acidenvExpr = `sine.range(${aLo}, ${aHi}).slow(${n}).late(${off})`
      else acidenvExpr = `"<${Array.from({ length: n }, () => r2(aLo + aRng.next() * (aHi - aLo))).join(' ')}>"` // abrupt per-bar steps
      const frag = this.bass.buildBass({
        rng: bassRng, roots, sound: style.bassSound, rest: style.bassRest, groove,
        saturation: muffled ? 0.08 : 0.3 + mood.fx.saturation * 0.3, acidenv: acidenvExpr,
      })
      // filter breathes within the section (.slow) AND its ceiling opens over the block.
      // When the bass ENTERS, it slams in too hard → instead sweep the cutoff up from near-CLOSED
      // (90Hz) across the section start, so the bass eases in tonally (a light filter build-up) on
      // top of the gain ramp (bassEnter). .late aligns the sweep's start to the section's first bar.
      const ceil = Math.round(560 + (0.35 + 0.65 * blockProgress) * (muffled ? 400 : 1000))
      const bassLpf = entered('bass')
        ? `saw.range(90, ${ceil}).slow(${n})${lateAlign}`
        : `saw.range(${muffled ? 240 : 420}, ${ceil}).slow(${n})${lateAlign}`
      const fm = style.bassFm > 0 ? `.fm(${style.bassFm}).fmh(2)` : ''
      // FAT (peak only — keep the intro soft): octave-up gritty mid-bass + wide unison reese
      const fat = muffled ? '' : '.superimpose(x => x.add(note(12)).s("square").distort("1.5:0.4").gain(0.34).lpf(1400))'
      const wide = !muffled && style.bassSound === 'supersaw' ? '.unison(5).detune(0.5)' : ''
      // main bass yields the spotlight per-bar in peaks (bassEmph) but never goes silent;
      // its level is trimmed a touch so the kick/snares read 1.5× more forward.
      layers.push(orbit(`${frag}${wide}.clip(0.95).lpf(${bassLpf})${fm}${fat}${fxFor(0.2, 0.16)}.gain(${g(MIX.bass)})${bassEmph}${bassEnter}${pump}`, ORBIT.bass))
      // sub-sine for FAT low weight — held CONSTANT (no emphasis dip) so the low end is
      // unbroken even when the mid-bass steps back for the lead (ducked under the kick).
      // Reinforces the bass fundamental at its OWN octave (not another octave below): the
      // main bass already sits at C1–B1, so a sub beneath that would be subsonic mud.
      layers.push(orbit(`note("${seqAligned(roots.map(String))}").s("sine").gain(${g(MIX.sub)})${bassEnter}.lpf(150)${pump}`, ORBIT.fx))
    }

    // ── BACKGROUND — a subtle, in-key texture (drone / sub-pulse / sonar ping / wind /
    //    metallic / hum) that just fills & dilutes the track. NOT a melodic pad — those
    //    "atmosphere" pads were binned. Barely noticeable, sits on the tonic.
    if (shape.layers.bg) {
      const rootPc = ((chord.notes[0] % 12) + 12) % 12 + 36 // tonic, low register
      // bg textures carry their own (small) levels; CAP each (so the louder textures can't pierce)
      // then scale them ALL by MIX.bgScale → background stays near-subliminal in every track.
      const gBg = (x: number) => g(MIX.bgScale * Math.min(x, MIX.bgCap))
      layers.push(orbit(this.bgTexture(style.bg, rootPc, gBg, fxFor) + bgEnter, ORBIT.fx))
    }

    // ── LEAD — ONE locked motif per movement; variety comes from FX (filter/echo), not new notes.
    //    leadPresence thins it out: 'none' = no lead (kept ONLY for float, which it carries),
    //    'sparse' = peaks only, 'full' = build+peak. Many tracks sound better with little/no lead.
    const leadOn = shape.layers.lead && (style.leadPresence === 'full' || role === 'float' || (style.leadPresence === 'sparse' && peak))
    if (leadOn) {
      // Keep the track's natural voice — DON'T force a fat unison stack (that made the lead
      // aggressive, loud and detached from the track). Just the track's own width, if any.
      const leadVoice = style.leadUnison > 0
        ? `.s("${style.leadSound}").unison(${style.leadUnison}).detune(0.18)`
        : `.s("${style.leadSound}")`
      // filter opens with the block but stays DARK (ceiling capped ~1650) so the lead sits
      // inside the track instead of screaming over it.
      const ceil = Math.round(750 + (lpf - 750) * Math.max(0.3, blockProgress))
      const ceilCap = Math.min(1300, Math.max(750, ceil)) // lower ceiling → the lead reads as a tone, never pierces
      // TRANSITION = a filter OPEN (not a stepped gain). When the lead enters (or the peak
      // block starts) the cutoff sweeps up from near-CLOSED (220Hz = almost inaudible) across
      // the section start, so it eases in instead of bursting. Otherwise it breathes.
      const leadEntering = entered('lead') || (peak && pos === bStart)
      const leadLpf = leadEntering
        ? `saw.range(220, ${ceilCap}).slow(${n})${lateAlign}`
        : `saw.range(560, ${ceilCap}).slow(${n})${lateAlign}`
      // a single octave-DOWN shadow for dark weight — quiet so it doesn't add loudness
      const fatLead = '.superimpose(x => x.add(note(-12)).gain(0.28).lpf(900))'
      // AFTER THE BREAK: develop the lead with an in-key TRANSPOSITION pattern (Switch-Angel
      // style — .add(<changing offsets>)). The same riff shifts harmonically per bar (over a
      // root pedal it reads as an implied progression) and is KEPT to the track's end.
      // DESCENDING / returning only — an ASCENDING climb (e.g. 0 3 5 7) reads as a cheesy
      // "tropical" uplift, which is banned. These fall back home or hold, like the reference.
      const LEAD_DEV = ['0 0 0 0', '7 5 3 0', '5 0 0 0', '0 0 -5 0', '7 0 5 0', '0 -7 0 0', '3 0 0 0', '0 5 0 0']
      const leadDev = this.afterBreak ? `.add(note("${seqAligned(LEAD_DEV[createRng(`${track.seed}:ldev`).int(LEAD_DEV.length)].split(' '))}"))` : ''
      if (style.dropLead === 'arp' && !memory) {
        layers.push(orbit(`${this.arp(chord, style.stabSound)}${leadDev}${fxFor(0.7, 1.2)}${fatLead}.pan(sine.slow(4)).gain(${g(MIX.lead * 0.9)})${leadEmph}.lpf(${leadLpf})${pump}`, ORBIT.arp))
      } else {
        const { fragment, state } = this.melody.buildLead(chord, {
          rng, leadOctave: this.config.leadOctave, density: mood.density,
          scale: track.tonality.scale, keyRoot: keyRootMidi(track.tonality.key), anti: this.anti,
        }, this.lead)
        this.lead = state
        // quieter, softer attack, gentler resonance, more reverb (sits IN the track, not on
        // top). lpq 2 = barely-resonant so it reads as a tone, not a screaming acid line.
        layers.push(orbit(`${fragment}${leadDev}${leadVoice}.acidenv(0.4).lpq(2).attack(0.012).dec(0.12)${fxFor(0.7, 1.2)}${fatLead}.asym("1:0.9").hpf(200).pan(sine.slow(6).range(0.4, 0.6)).gain(${g(MIX.lead)})${leadEmph}.lpf(${leadLpf})`, ORBIT.lead))
      }
    }

    // ── BREAK enrichment — the 8-bar rest must EVOLVE, not idle. A long noise swell whose
    //    filter opens across the section, a tom fill that thickens every other bar, a lone
    //    echo-drenched chord stab to hold harmonic interest, and a riser that telegraphs
    //    the return over the LAST 2 bars. (The kick + hats + snare groove is already on.)
    if (role === 'break') {
      // (0) ECHO THROW — the lead riff from the peak we just left (its motif is still in
      //     this.lead, reset only at the end of this call) plays ONCE on the break's first
      //     bar, drowned in long-feedback delay + reverb so it rings out and dissolves into
      //     the breakdown — a tail of the previous part bleeding through. Continuity glue.
      const echoMotif = this.lead.motif
      if (echoMotif) {
        let onset = 0
        const steps: string[] = []
        for (let i = 0; i < 16; i++) {
          if (echoMotif.mask[i]) { steps.push(String(echoMotif.notes[onset % echoMotif.notes.length])); onset++ }
          else steps.push('~')
        }
        // A ghostly tail, NOT a bright blast: darker filter, lower level, softer attack,
        // thinned notes and a gentler feedback so it dissolves instead of stabbing the ear.
        layers.push(orbit(`note("${firstBar(`[${steps.join(' ')}]`)}").s("${style.leadSound}").degradeBy(0.4).acidenv(0.4).lpq(2).attack(0.02).dec(0.12).hpf(180).delay(0.6).delaytime(${style.fx.delayTime}).delayfeedback(0.62).room(0.6).roomsize(7).gain(${g(0.26)}).lpf(1500)`, ORBIT.lead))
      }
      // (1) BUILD-BACK — diversified per break (seeded) so it ISN'T the same white-noise riser every
      //     time. 'drop' is the minimal alternative (mostly air → only the last 2 bars lift), so not
      //     every break risers hard. seqAligned/.late keep every climb locked to the section boundary.
      const rRng = createRng(`${track.seed}:riser${pos}`)
      const scheme = (['noise', 'snare', 'pitch', 'drop'] as const)[rRng.int(4)]
      const rollAccel = seqAligned(['~', '~', '~', '~', '[sd sd]', '[sd*2 sd*2]', '[sd*4 sd*4]', '[sd*8 sd*16]'])
      if (scheme === 'noise') {
        layers.push(orbit(`s("white*16").dec(0.08).lpf(saw.range(400, 11000).slow(${n})${lateAlign}).hpf(250).gain(saw.range(0.06, ${g(0.82)}).slow(${n})${lateAlign}).pan(sine.slow(5))${fxFor(0.3, 0.5)}`, ORBIT.fx))
        layers.push(orbit(`s("${rollAccel}").gain(saw.range(0.1, ${g(0.82)}).slow(${n})${lateAlign}).hpf(260).lpf(6500)${fxFor(0.2, 0.4)}`, ORBIT.snare))
      } else if (scheme === 'snare') {
        layers.push(orbit(`s("${rollAccel}").gain(saw.range(0.12, ${g(0.9)}).slow(${n})${lateAlign}).hpf(220).lpf(7000).room(0.3).shape(0.06)${fxFor(0.2, 0.5)}`, ORBIT.snare))
        layers.push(orbit(`s("hh*16").gain(saw.range(0.02, ${g(0.3)}).slow(${n})${lateAlign}).hpf(8000)`, ORBIT.perc))
      } else if (scheme === 'pitch') {
        const rRoot = ((chord.notes[0] % 12) + 12) % 12 + 36 // a tone gliding UP an octave = a pitched riser
        layers.push(orbit(`note("${rRoot}").s("sawtooth").add(note(saw.range(0, 12).slow(${n})${lateAlign})).lpf(saw.range(500, 5000).slow(${n})${lateAlign}).gain(saw.range(0.05, ${g(0.42)}).slow(${n})${lateAlign}).hpf(200)${fxFor(0.3, 0.5)}`, ORBIT.fx))
        layers.push(orbit(`s("${rollAccel}").gain(saw.range(0.08, ${g(0.6)}).slow(${n})${lateAlign}).hpf(260).lpf(6000)${fxFor(0.2, 0.4)}`, ORBIT.snare))
      } else {
        const last2 = seqAligned([...Array(Math.max(1, bars - 2)).fill('~'), '[sd*4 sd*4]', '[sd*8 sd*16]'])
        layers.push(orbit(`s("${last2}").gain(${g(0.72)}).hpf(260).lpf(6500)${fxFor(0.2, 0.4)}`, ORBIT.snare))
      }
      // colour: a tom fill + a lone echo-drenched chord stab (harmony), in every scheme.
      layers.push(orbit(`s("${seqAligned(['~', '[lt mt]', '~', '[mt lt mt]', '~', '[lt mt lt]', '~', '[mt*4]'])}").gain(${g(0.4)}).room(0.3)${fxFor(0.3, 0.4)}`, ORBIT.perc))
      const stabRoot = ((chord.notes[0] % 12) + 12) % 12 + 48 // tonic, mid register
      layers.push(orbit(`note("${seqAligned([String(stabRoot), '~', '~', '~'])}").s("${style.stabSound}").lpf(1200).dec(0.4).gain(${g(0.28)})${fxFor(0.8, 0.9)}`, ORBIT.fx))
      // PREVIEW LEAD — a soft, dark chord arp that swells in over the break's last ~4 bars: same
      // harmony as the coming drop but a DIFFERENT voice/figure (a teaser that "fits but differs").
      const pcs = chord.notes.slice(0, 3).map((nn) => ((nn % 12) + 12) % 12 + 48)
      const fig = `[${pcs.join(' ')}]`
      const figR = `[${pcs.slice().reverse().join(' ')}]`
      const preview = Array<string>(bars).fill('~')
      for (let i = Math.max(0, bars - 4); i < bars; i++) preview[i] = (i % 2 === 0 ? fig : figR)
      layers.push(orbit(`note("${seqAligned(preview)}").s("${style.stabSound}").lpf(saw.range(300, 1400).slow(${n})${lateAlign}).lpq(3).dec(0.18).gain(saw.range(0.02, ${g(0.16)}).slow(${n})${lateAlign}).hpf(250)${fxFor(0.6, 0.9)}`, ORBIT.arp))
    }

    // Through-line FM-pulse riser texture (Switch-Angel style): an evolving tension
    // shimmer that morphs via fmtime over 64 cycles — in builds and the 2nd movement.
    if (style.riser && (role === 'build' || (this.afterBreak && role === 'peak'))) {
      layers.push(orbit(`s("pulse!16").dec(tri.mul(0.3).fast(4)).fmtime(16, 64).hpf(900).gain(${g(0.2)}).pan(sine.slow(7))${fxFor(0.3, 0.4)}`, ORBIT.fx))
    }

    const body = layers.length > 0 ? `stack(\n  ${layers.join(',\n  ')}\n)` : 'silence'
    const strudelCode = `setcpm(${track.bpm}/4)\n${body}`

    const musicalState: MusicalState = {
      seed: this.seed,
      trackIndex: track.index,
      trackSeed: track.seed,
      strudelCode,
      mood: track.mood,
      sectionsUntilMoodChange: track.sectionsPerTrack - pos,
      key: track.tonality.key,
      scaleName: track.tonality.scaleName,
      chord: chord?.label ?? '',
      section: role,
      sectionBars: bars,
      bpm: track.bpm,
      bar: this.bar,
      layers: shape.layers,
    }

    this.bar += bars
    // The break ends the first movement: fresh lead motif + new bass riff afterwards.
    if (role === 'break') { this.afterBreak = true; this.lead = initialLeadState() }
    this.scheduler.tick()
    if (this.scheduler.isTrackStart()) { this.lead = initialLeadState(); this.afterBreak = false }
    return { strudelCode, musicalState }
  }

  /** Subtle, in-key background texture to fill/dilute the track (replaces the old pad).
   *  20 flavours — drones, beepers, noise textures, tonal shimmers — all quiet & dark. */
  private bgTexture(kind: BgKind, root: number, g: (x: number) => number, fxFor: (d: number, r: number) => string): string {
    switch (kind) {
      // ── drones / hums ─────────────────────────────────────────────────────────────
      case 'drone':     return `note("${root - 12}").s("sawtooth").attack(1).release(6).lpf(420).gain(${g(0.11)})${fxFor(0.1, 0.5)}`
      case 'hum':       return `note("${root - 12}").s("sawtooth").detune(0.06).unison(2).lpf(300).gain(${g(0.1)})`
      case 'tremdrone': return `note("${root - 12}").s("sawtooth").attack(1).release(6).lpf(400).gain(${g(0.12)}).gain(sine.slow(6).range(0.4, 1))`
      case 'organ':     return `note("[${root - 12},${root - 5}]").s("sine").attack(0.5).release(5).gain(${g(0.1)})${fxFor(0.1, 0.5)}`
      case 'sweepdrone':return `note("${root - 12}").s("sawtooth").attack(1).release(6).lpf(sine.range(250, 900).slow(24)).gain(${g(0.11)})`
      // ── pulses / beepers ──────────────────────────────────────────────────────────
      case 'subpulse':  return `note("${root - 12}").struct("x ~ x ~").s("sine").attack(0.04).release(0.5).lpf(180).gain(${g(0.16)})`
      case 'sonar':     return `note("${root + 24}").struct("x ~ ~ ~ ~ ~ ~ ~").s("sine").decay(0.4).gain(${g(0.07)})${fxFor(1, 1)}.pan(0.65)`
      case 'metallic':  return `note("${root + 19}").struct("~ ~ ~ ~ x ~ ~ ~").s("sine").fm(8).fmh(3.3).decay(0.25).gain(${g(0.07)})${fxFor(0.9, 0.9)}.pan(0.4)`
      case 'morse':     return `note("${root + 12}").struct("x x ~ x ~ ~ x ~").s("square").decay(0.05).lpf(2000).gain(${g(0.06)})${fxFor(0.6, 0.4)}.pan(0.6)`
      case 'bell':      return `note("${root}").struct("x ~ ~ ~ ~ ~ ~ ~").s("sine").fm(3).fmh(1.4).decay(2).gain(${g(0.08)})${fxFor(0.8, 1.2)}`
      // ── noise textures ────────────────────────────────────────────────────────────
      case 'wind':      return `s("white*8").dec(0.5).lpf(sine.range(300, 1100).slow(16)).hpf(220).gain(${g(0.07)}).pan(sine.slow(11))`
      case 'crackle':   return `s("white*16").dec(0.01).degradeBy(0.7).hpf(1500).lpf(5000).gain(${g(0.09)}).pan(sine.slow(9))`
      case 'hiss':      return `s("white*4").dec(0.4).hpf(3000).gain(${g(0.05)}).pan(sine.slow(13))`
      case 'geiger':    return `s("white*16").dec(0.005).degradeBy(0.82).hpf(4000).gain(${g(0.1)}).pan(rand)`
      case 'resonance': return `note("${root + 12}").s("sawtooth").lpf(900).lpq(16).gain(${g(0.05)})${fxFor(0.4, 0.7)}`
      // ── tonal shimmers ────────────────────────────────────────────────────────────
      case 'sinearp':   return `note("${root} ${root + 3} ${root + 7} ${root + 10}").slow(2).s("sine").decay(0.3).gain(${g(0.07)})${fxFor(0.7, 0.8)}.pan(sine.slow(7))`
      case 'granular':  return `s("white*16").dec(0.02).speed("<1 2 0.5 1.5>").hpf(2000).gain(${g(0.06)}).pan(rand)`
      case 'choir':     return `note("[${root - 12},${root - 9},${root - 5}]").s("sawtooth").attack(1.2).release(5).lpf(600).gain(${g(0.06)})${fxFor(0.3, 1.4)}`
      case 'siren':     return `note("${root + 7}").add(note(sine.slow(12).range(-0.3, 0.3))).s("sine").lpf(800).gain(${g(0.05)})${fxFor(0.4, 1)}`
      default:          return `note("${root - 12}").s("sine").lpf(200).gain(${g(0.1)})`
    }
  }

  /** Per-track extra percussion colour. Missing samples just stay silent (no crash). */
  private percLayer(kind: PercKind, g: (x: number) => number): string {
    switch (kind) {
      case 'rim': return `s("~ rim ~ rim").gain(${g(0.4)}).room(0.25)`
      case 'shaker': return `s("hh*16").gain(${g(0.2)}).hpf(9000).pan(sine.fast(2))`
      case 'noise': return `s("white*8").dec(0.015).hpf(10000).gain(${g(0.25)}).pan(sine.slow(3))`
      case 'ride': return `s("[~ hh]*4").gain(${g(0.28)}).hpf(6500)`
      case 'tom': return `s("~ lt ~ ~ ~ mt ~ ~").gain(${g(0.4)}).room(0.2)`
      default: return ''
    }
  }

  /** A bright 16th-note arpeggio anchored to a fixed octave (~MIDI 60–83), never shrill. */
  private arp(chord: Chord, sound: string): string {
    const pcs = chord.notes.slice(0, 3).map((nn) => ((nn % 12) + 12) % 12)
    const base = 48 // low/dark register — not a bright ascending trance uplift
    const steps: string[] = []
    for (let i = 0; i < 16; i++) {
      const oct = Math.floor((i % (pcs.length * 2)) / pcs.length) * 12
      steps.push(String(base + pcs[i % pcs.length] + oct))
    }
    const det = sound === 'supersaw' ? '.detune(0.2)' : ''
    return `note("${steps.join(' ')}").s("${sound}")${det}.dec(0.1).hpf(300)`
  }
}

function orbit(code: string, nn: number): string { return `(${code}).orbit(${nn})` }
function r2(nn: number): number { return Math.round(nn * 100) / 100 }
