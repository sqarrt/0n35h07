import { createRng, randomSeed, type Rng } from '../seededRandom'
import type { RadioBanks } from './banks'
import type { RadioConfig } from './radioConfig'
import { AntiRepeatBuffer } from './AntiRepeatBuffer'
import { RhythmEngine } from './engines/RhythmEngine'
import { MelodyEngine, initialLeadState, type LeadState, type LeadVoiceId } from './engines/MelodyEngine'
import { BassEngine } from './engines/BassEngine'
import { TimbreEngine, initialDrift, type DriftState } from './engines/TimbreEngine'
import { CompositionScheduler } from './CompositionScheduler'
import { shapeFor, type SectionRole } from './arrangement'
import type { PercKind, BgKind, BassArchetype, DrumArchetype } from './trackStyle'
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
  bgScale: 0.35, // multiplies each bg texture's own (already small) level. 0.32→0.7 (triage demos were too quiet) was
                 // too much in the real full mix → halved to 0.35: a subtle but present bed. Per-texture trims below.
  bgCap: 0.18,  // HARD ceiling on a bg texture's pre-scale level (raised from 0.06 with bgScale so per-texture levels matter)
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
  // Inter-track gap accounting: the controller plays config.trackGapBars of silence between tracks and
  // Strudel's cycle clock keeps running through it, so `bar` must jump by that amount at each AUTO track
  // boundary to stay aligned — else section sweeps (risers) drift. skipNextGap suppresses it after a manual
  // jump/reseed and for the very first track (the controller inserts no gap there).
  private skipNextGap = true
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
    this.skipNextGap = true   // a manual jump/reseed has no preceding inter-track gap
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
    // Cross-track gap accounting (see skipNextGap): on a fresh track's first section, advance `bar` by the
    // silent gap the controller plays before it, so Strudel's cycle clock and our counter stay in step.
    if (pos === 0) { if (this.skipNextGap) this.skipNextGap = false; else this.bar += this.config.trackGapBars }
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
    const muffled = role === 'intro' || role === 'introB'
    const memory = role === 'intro' || role === 'introB' || role === 'break' // atmospheric, echo-drenched

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
    // NB: the bg gets NO ease-in ramp — a subliminal texture must hold a STEADY level (a rising/ramping bg
    // re-entering after each peak read as "the background is getting louder", which the user dislikes).
    const percEnter = entered('perc') ? easeIn : '' // perc no longer slams in at build→peak

    // LEAD presence + the DROP before its first entry. leadOnFor mirrors the lead gate (below) for ANY role, so
    // we can tell when the lead FIRST appears (the previous section had no lead). When it does, DIVIDE the track:
    // the kick/bass/perc duck to SILENCE on bar 0 (a held breath while the lead's filter opens) and the groove
    // SLAMS back on bar 1 with a crash — the lead arrives as an event, not a pile-on (Switch Angel: drop-before-lead).
    const leadOnFor = (r?: SectionRole): boolean =>
      !!r && shapeFor(r).layers.lead && (style.leadPresence === 'full' || r === 'float' || r === 'introB' || (style.leadPresence === 'sparse' && r === 'peak'))
    // CONTINUITY: when a track OPENS on a lead-featured section (float/introB), the lead must CARRY through the
    // rest of the FIRST movement (every lead-layer section up to the first break) instead of dropping dead in
    // the next build — otherwise a solo lead in the intro is followed by a bandful with NO lead (a broken track).
    // The arc already guarantees a lead-bearing section follows the opening; this stops `sparse` from muting it.
    const openLead = track.arc[0] === 'float' || track.arc[0] === 'introB'
    const firstBreak = ((): number => { const i = track.arc.findIndex((r) => r === 'break' || r === 'outro'); return i < 0 ? track.arc.length : i })()
    const leadOnAt = (p: number): boolean => {
      const r = track.arc[p] as SectionRole | undefined
      return !!r && (leadOnFor(r) || (openLead && p < firstBreak && shapeFor(r).layers.lead))
    }
    const leadOn = leadOnAt(pos)
    const leadEntered = leadOn && pos > 0 && role !== 'float' && !leadOnAt(pos - 1)
    const dropDuck = leadEntered ? `.gain("${seqAligned(['0', ...Array(Math.max(1, bars - 1)).fill('1')])}")` : ''
    // Atmospheric "exit" sections — a BREAK or an INTRO — duck their whole body to silence on the LAST bar, so
    // the per-exit FILL (silence/rhythmic/melodic) stands ALONE there: the last bar then differs from both the
    // section body AND the next part. (Applies to both the break's exit and the intro→build exit.)
    const isExit = role === 'break' || role === 'intro' || role === 'introB'
    const exitDuck = isExit ? `.gain("${seqAligned([...Array(Math.max(1, bars - 1)).fill('1'), '0'])}")` : ''

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
    // Raised floor (was 0.74 + 0.26·energy) so the low-energy sections (intro/break/outro) sit a bit LOUDER —
    // they read as quiet without being too quiet; peaks (energy≈0.94) barely move.
    const energyEnv = 0.83 + 0.17 * energy
    // LOUDNESS NORMALISATION — trim the parts in a FULL section so they don't pile up louder than the body
    // average (the KICK keeps its own energy curve as the steady reference). partSq = the combined non-kick
    // load; normScale brings an over-full section (a peak with perc stacked on) back toward a target. It only
    // TRIMS, never boosts → sparser sections (intro/build) are untouched, so the track stays ~even throughout.
    const partSq = (shape.layers.bass ? MIX.bass * MIX.bass + MIX.sub * MIX.sub : 0)
      + (shape.layers.perc ? MIX.hat * MIX.hat + MIX.snare * MIX.snare + (peak ? MIX.clap * MIX.clap : 0) : 0)
    const NORM_TARGET = 0.8
    const normScale = partSq > 0 ? Math.min(1, NORM_TARGET / Math.sqrt(partSq)) : 1
    const g = (level: number) => r2(MASTER * level * energyEnv * normScale)
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

    // The track's drum GROOVE kit (null = the original 4-floor техно, per-element style fields). A BREAK always
    // reverts to a steady 4-floor kick regardless of kit, so it stays the calm anchor.
    const drumKit = style.drumArchetype !== 'existing' ? DRUM_KITS[style.drumArchetype] : null

    // ── KICK ──
    if (shape.layers.kicks) {
      const deep = role === 'break' // steady, darker kick that holds the rest together
      const base = deep ? 'bd*4' : drumKit ? drumKit.kick : (mood.density < 0.5 ? 'bd*4' : style.kickPat)
      let kickPat = base
      // The fill/drop must land on the section's LAST bar → seqAligned (and `[base]` keeps a multi-token
      // pattern like "bd ~ bd bd" as one bar so the !-repeat can't bind to its last token).
      if (preKind === 'kickDrop') kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~']) // drop the last bar
      else if (boundaryOut) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), fillNext ? '[bd*2 bd bd bd]' : '[bd bd bd bd]'])
      // break: cut the kick on the FINAL bar so the riser/roll peak alone fills the gap.
      else if (deep) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~'])
      // Kick is the loud global reference (drives the whole balance). Composition-independent.
      const kickShape = r2(Math.max(0, (mood.density - 0.45) * 0.45) + (peak ? 0.12 : 0) + (!deep && drumKit?.shape ? drumKit.shape : 0))
      const kickGain = r2(MASTER * MIX.kick * energyEnv * (muffled ? 0.85 : deep ? 0.92 : 1))
      const kickLpf = deep ? '.lpf(1500)' : muffled ? '.lpf(900)' : drumKit?.lpf ?? (mood.density < 0.5 ? '.lpf(2200)' : '')
      // per-track kick voice: a drum-machine bank (909/808/…) or a dirt bd variant via .n()
      const kv = style.kickVoice
      const kvoice = (kv.bank ? `.bank("${kv.bank}")` : '') + `.n(${kv.n})`
      layers.push(orbit(`s("${kickPat}")${kvoice}.gain("${drums.gain}").shape(${kickShape}).gain(${kickGain})${kickLpf}${dropDuck}${exitDuck}`, ORBIT.kicks))
    }

    // drop-before-lead: a crash on bar 1 marks the groove SLAMMING back after the bar-0 silence.
    if (leadEntered) layers.push(orbit(`s("${seqAligned(['~', 'white', ...Array(Math.max(0, bars - 2)).fill('~')])}").dec(0.8).hpf(2500).gain(${g(0.42)}).room(0.6).roomsize(8)`, ORBIT.fx))

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
      // breathing hats: decay wobbles via a fast triangle LFO (Switch-Angel detail). The BREAK gets a SIMPLER,
      // softer hat (a plain off-pulse instead of the track's busy pattern) so it doesn't feel aggressive there.
      const hatPat = role === 'break' ? '[hh ~]*2' : (drumKit ? drumKit.hat : style.hatPat)
      const hatGain = role === 'break' ? MIX.hat * 0.7 : MIX.hat
      const swing = drumKit ? drumKit.swing : style.swing
      const hats = `s("${hatPat}").dec(tri.fast(4).range(0.05, 0.12)).gain(${g(hatGain)})${percEnter}.pan(sine.slow(4))` + (swing > 0 ? `.swingBy(${r2(swing)}, 4)` : '')
      layers.push(orbit(hats + dropDuck + exitDuck, ORBIT.perc))
      // No snare ROLLS in a break (the ply-doubling reads as aggressive); just the plain halved backbeat. The
      // kit's snare pattern carries the groove (amen rolls / broken claps), but a BREAK reverts to a calm backbeat.
      const snPly = role === 'break' ? 0 : peak ? 0.28 : 0.14
      const snarePat = role === 'break' ? '~ sd ~ sd' : (drumKit ? drumKit.snare : '~ sd ~ sd')
      layers.push(orbit(`s("${snarePat}").sometimesBy(${snPly}, x => x.ply(2)).gain(${g(MIX.snare * (role === 'break' ? 0.5 : 1))})${percEnter}${fxFor(0, 0.35)}.shape(${r2(Math.min(0.14, mood.fx.saturation * 0.16))}).lpf(7500)${dropDuck}${exitDuck}`, ORBIT.snare))
      // a quiet GHOST-snare rattle (amen) — adds the breakbeat feel; only when the kit defines it, never in a break.
      if (drumKit?.ghost && role !== 'break') layers.push(orbit(`s("${drumKit.ghost}").gain(${g(MIX.snare * 0.32)})${percEnter}.shape(0.1).lpf(6000)${dropDuck}${exitDuck}`, ORBIT.snare))
      // a dubby off-pulse RIM (minimal) — its hypnotic click with delay, when the kit defines it.
      if (drumKit?.rim && role !== 'break') layers.push(orbit(`s("${drumKit.rim}").gain(${g(MIX.snare * 0.6)})${percEnter}.hpf(800).room(0.35).roomsize(8).delay(0.3).delaytime(${style.fx.delayTime}).delayfeedback(0.5)${dropDuck}${exitDuck}`, ORBIT.perc))
      // peak-only claps on the backbeat (one extra layer, eased in). The kit's clap pattern when present.
      if (peak) {
        layers.push(orbit(`s("${drumKit ? drumKit.clap : style.clapPat}").gain(${g(MIX.clap)})${percEnter}${fxFor(0, 0.3)}.shape(0.08).lpf(7500)${dropDuck}`, ORBIT.snare))
      }
      // The busy aux-perc (rim/shaker/tom…) is dropped in a BREAK — it's the main source of break "aggression";
      // the kick + simple hats + halved snare are enough to keep the rest alive.
      const perc = this.percLayer(style.perc, g)
      if (perc && role !== 'break') layers.push(orbit(`${perc}${percEnter}${dropDuck}${exitDuck}`, ORBIT.perc))
    }

    // ── BASS — one of 7 CHARACTERS (style.bassArchetype): the original 303 acid riff, or a co-designed dark/
    //    electronic winner (tournament — docs/radio-part-archetypes.md). All follow the progression root per bar
    //    (.add(note("<roots>"))), never go silent (no `~`), and share the entry filter sweep + gain/pump/ducks.
    if (shape.layers.bass) {
      const roots = seq.map((c) => ((c.notes[0] % 12) + 12) % 12 + 12 * (this.config.bassOctave + 1))
      // filter breathes within the section (.slow) AND its ceiling opens over the block; on ENTRY it sweeps up
      // from near-CLOSED (90Hz) so the bass eases in tonally. .late aligns the sweep to the section's first bar.
      const ceil = Math.round(560 + (0.35 + 0.65 * blockProgress) * (muffled ? 400 : 1000))
      const bassLpf = entered('bass')
        ? `saw.range(90, ${ceil}).slow(${n})${lateAlign}`
        : `saw.range(${muffled ? 240 : 420}, ${ceil}).slow(${n})${lateAlign}`
      let bassMain: string
      if (style.bassArchetype === 'existing') {
        const groove = style.bassGroove.split(/\s+/).map((t) => t !== '~')
        // acid env WANDERS within the section so the squelch doesn't go stale; capped 0.65, motion per-section.
        const aRng = createRng(`${track.seed}:aenv${pos}`)
        const center = Math.min(0.6, 0.3 + 0.25 * blockProgress + (this.drift.acidenv - 0.4) * 0.25)
        const amp = muffled ? 0.08 : 0.16
        const aHi = r2(Math.min(0.65, center + amp)); const aLo = r2(Math.max(0.12, center - amp))
        const motion = (['rise', 'fall', 'sine', 'jump'] as const)[aRng.int(4)]
        let acidenvExpr: string
        if (motion === 'rise') acidenvExpr = `saw.range(${aLo}, ${aHi}).slow(${n}).late(${off})`
        else if (motion === 'fall') acidenvExpr = `saw.range(${aHi}, ${aLo}).slow(${n}).late(${off})`
        else if (motion === 'sine') acidenvExpr = `sine.range(${aLo}, ${aHi}).slow(${n}).late(${off})`
        else acidenvExpr = `"<${Array.from({ length: n }, () => r2(aLo + aRng.next() * (aHi - aLo))).join(' ')}>"`
        const frag = this.bass.buildBass({
          rng: bassRng, roots, sound: style.bassSound, rest: style.bassRest, groove,
          saturation: muffled ? 0.08 : 0.3 + mood.fx.saturation * 0.3, acidenv: acidenvExpr,
        })
        const fm = style.bassFm > 0 ? `.fm(${style.bassFm}).fmh(2)` : ''
        const fat = muffled ? '' : '.superimpose(x => x.add(note(12)).s("square").distort("1.5:0.4").gain(0.34).lpf(1400))'
        const wide = !muffled && style.bassSound === 'supersaw' ? '.unison(5).detune(0.5)' : ''
        bassMain = `${frag}${wide}.clip(0.95).lpf(${bassLpf})${fm}${fat}`
      } else {
        // co-designed dark/electronic archetype, transposed onto the progression roots.
        const v = BASS_VOICES[style.bassArchetype]
        const filt = v.filt ? v.filt(n, lateAlign) : `.lpf(${bassLpf})`
        bassMain = `note("${v.off}")${v.shove ?? ''}.add(note("<${roots.join(' ')}>"))${v.drift ? v.drift(n, lateAlign) : ''}${v.src}${v.fx}.clip(0.95)${filt}`
      }
      // main bass yields the spotlight per-bar in peaks (bassEmph) but never goes silent; trimmed so kick/snares read forward.
      layers.push(orbit(`${bassMain}${fxFor(0.2, 0.16)}.gain(${g(MIX.bass)})${bassEmph}${bassEnter}${dropDuck}${exitDuck}${pump}`, ORBIT.bass))
      // sub-sine for FAT low weight — held CONSTANT (no emphasis dip) so the low end is
      // unbroken even when the mid-bass steps back for the lead (ducked under the kick).
      // Reinforces the bass fundamental at its OWN octave (not another octave below): the
      // main bass already sits at C1–B1, so a sub beneath that would be subsonic mud.
      layers.push(orbit(`note("${seqAligned(roots.map(String))}").s("sine").gain(${g(MIX.sub)})${bassEnter}${dropDuck}${exitDuck}.lpf(150)${pump}`, ORBIT.fx))
    }

    // ── BACKGROUND — a subtle, in-key texture (drone / sub-pulse / sonar ping / wind /
    //    metallic / hum) that just fills & dilutes the track. NOT a melodic pad — those
    //    "atmosphere" pads were binned. Barely noticeable, sits on the tonic.
    if (shape.layers.bg) {
      const rootPc = ((chord.notes[0] % 12) + 12) % 12 + 36 // tonic, low register
      // bg textures carry their own (small) levels; CAP each (so the louder textures can't pierce)
      // then scale them ALL by MIX.bgScale → background stays near-subliminal in every track.
      const gBg = (x: number) => g(MIX.bgScale * Math.min(x, MIX.bgCap))
      // Two-tier bg (de-fingerprinting): a subliminal BED always, plus an occasional distinctive ACCENT.
      // Each is PARAMETERISED per-track (register / struct rotation / timbre / pan) so even a repeated kind is
      // never identical — what made a bell or sonar "jump out" when it recurred.
      const bedV = bgVary(createRng(`${track.seed}:bg`))
      layers.push(orbit(this.bgTexture(style.bg, rootPc + bedV.oct, gBg, fxFor, bedV) + exitDuck, ORBIT.fx))
      if (style.bgAccent) {
        const accV = bgVary(createRng(`${track.seed}:bgacc`))
        layers.push(orbit(this.bgTexture(style.bgAccent, rootPc + accV.oct, gBg, fxFor, accV) + exitDuck, ORBIT.fx))
      }
    }

    // ── LEAD — ONE locked motif per movement; variety comes from FX (filter/echo), not new notes.
    //    leadPresence thins it out: 'none' = no lead (kept ONLY for float, which it carries),
    //    'sparse' = peaks only, 'full' = build+peak. Many tracks sound better with little/no lead.
    //    (leadOn / leadEntered are computed up top so the kick/bass can drop before the lead's first entry.)
    // INTERMITTENT: the lead RESTS on every 8th peak loop (it does not play the whole time — Switch Angel) so it
    // breathes; the groove (bass call-and-response) carries that loop. Not on float (the lead IS the section).
    // (Eased from every-4th — the leads are loved, let them play longer between breaths.)
    const leadRest = peak && (pos - bStart) % 8 === 7
    if (leadOn && !leadRest) {
      // Keep the track's natural voice — DON'T force a fat unison stack (that made the lead
      // aggressive, loud and detached from the track). Just the track's own width, if any.
      const leadVoice = style.leadUnison > 0
        ? `.s("${style.leadSound}").unison(${style.leadUnison}).detune(0.18)`
        : `.s("${style.leadSound}")`
      // FLOAT carries the whole (drumless) passage on the lead ALONE → there it must be PROMINENT, not
      // the under-the-groove whisper used in builds/peaks (that left float sections near-silent). So in
      // float the lead is louder, brighter (higher ceiling) and its entry filter starts far less closed.
      const floaty = role === 'float' || role === 'introB' // openings → brighter filter / less-closed entry
      // Lead vs bass: when they play TOGETHER (bass present) the lead must be NOTICEABLY quieter than the bass.
      // float has NO bass → prominent; introB has bass → present but under it; build/peak → well under it.
      const leadLevel = role === 'float' ? MIX.lead * 2.7 : role === 'introB' ? MIX.lead * 1.3 : MIX.lead * 0.75
      // filter opens with the block but stays DARK in builds/peaks (capped ~1300) so the lead sits
      // inside the track; in float it opens much brighter so it actually sings.
      const ceil = Math.round(750 + (lpf - 750) * Math.max(0.3, blockProgress))
      const ceilCap = Math.min(floaty ? 2800 : 1300, Math.max(750, ceil))
      // TRANSITION = a filter OPEN (not a stepped gain). When the lead enters (or the peak block starts)
      // the cutoff sweeps up across the section start so it eases in. In float it starts far less closed
      // (520Hz, audible) instead of 220Hz (near-silent) so the opening doesn't read as dead air.
      const leadEntering = entered('lead') || (peak && pos === bStart)
      const leadLpf = leadEntering
        ? `saw.range(${floaty ? 520 : 220}, ${ceilCap}).slow(${n})${lateAlign}`
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
        layers.push(orbit(`${this.arp(chord, style.stabSound)}${leadDev}${fxFor(0.7, 1.2)}${fatLead}.pan(sine.slow(4)).gain(${g(leadLevel * 0.9)})${leadEmph}.lpf(${leadLpf})${pump}`, ORBIT.arp))
      } else {
        const { fragment, voice, state } = this.melody.buildLead(chord, {
          rng, leadOctave: this.config.leadOctave, density: mood.density,
          scale: track.tonality.scale, keyRoot: keyRootMidi(track.tonality.key), anti: this.anti,
        }, this.lead)
        this.lead = state
        // Render the picked archetype's synth+FX chain (LEAD_VOICES). `src` overrides the source (else the
        // track voice); a timbre voice may bring its own `filt`; otherwise the shared entry-sweep filter eases
        // it in (its ceiling raised for bright timbres). The composer owns level (loudness norm), pan and emphasis.
        const spec = LEAD_VOICES[voice]
        const src = spec.src ?? leadVoice
        const target = Math.max(spec.ceil ?? 0, ceilCap)
        const sweep = leadEntering ? `saw.range(${floaty ? 520 : 220}, ${target})` : `saw.range(560, ${target})`
        const filt = spec.filt ?? `.lpf(${sweep}.slow(${n})${lateAlign})`
        const fat = spec.fat ? fatLead : ''
        layers.push(orbit(`${fragment}${leadDev}${src}${spec.fx}${filt}${fat}.pan(sine.slow(6).range(0.3, 0.7)).gain(${g(leadLevel * (spec.lvl ?? 1))})${leadEmph}`, ORBIT.lead))
      }
    }

    // ── BREAK (reworked — NO risers). A breakdown with its OWN melodic identity: a soft echo-tail of the
    //    outgoing lead, then a DIFFERENT soulful lead (the atmoDyad ballad) developing via a slow filter bloom
    //    over the lightened groove, and a per-break FILL (silence / rhythmic / melodic) on the last bar.
    if (role === 'break') {
      // (0) ECHO THROW — the lead riff from the peak we just left (its motif is still in
      //     this.lead, reset only at the end of this call) plays ONCE on the break's first
      //     bar, drowned in long-feedback delay + reverb so it rings out and dissolves into
      //     the breakdown — a tail of the previous part bleeding through. Continuity glue.
      const echoMotif = this.lead.motif
      if (echoMotif) {
        // Replay the movement's lead pattern ONCE on the break's first bar, drowned in long-feedback delay +
        // reverb so it rings out and dissolves — a ghostly tail of the previous part bleeding through.
        layers.push(orbit(`note("${firstBar(`[${echoMotif.pattern}]`)}").s("${style.leadSound}").degradeBy(0.4).acidenv(0.4).lpq(2).attack(0.02).dec(0.12).hpf(180).delay(0.6).delaytime(${style.fx.delayTime}).delayfeedback(0.62).room(0.6).roomsize(7).gain(${g(0.26)}).lpf(1500)`, ORBIT.lead))
      }
      // (1) A DIFFERENT lead — one of the RESTFUL archetypes (the same 18-voice set as the main lead, filtered to
      //     the atmospheric ones), with its OWN timbre, picked to DIFFER from the track's main lead. Rendered LOW
      //     + echo-drowned (its own delay/room + a soft level + the last-bar exitDuck) so it rests the ears.
      //     Non-timbre voices get the break's slow filter BLOOM. (No risers; no wailing sustained pad.)
      const brkLpf = `.lpf(saw.range(500, 2000).slow(${n})${lateAlign})`
      const brk = this.melody.buildBreakLead({
        rng: createRng(`${track.seed}:brklead${this.afterBreak ? '2' : ''}`),
        leadOctave: this.config.leadOctave + 1, density: mood.density,
        scale: track.tonality.scale, keyRoot: keyRootMidi(track.tonality.key),
      }, this.lead.motif?.voice)
      const brkSpec = LEAD_VOICES[brk.voice]
      const brkSrc = brkSpec.src ?? `.s("${style.leadSound}")`
      const brkFilt = brkSpec.filt ?? brkLpf
      layers.push(orbit(`note("${brk.pattern}")${brkSrc}${brkSpec.fx}${brkFilt}.hpf(180).pan(sine.slow(6).range(0.3, 0.7)).gain(${g(0.18)})${exitDuck}`, ORBIT.lead))
    }

    // ── EXIT FILL — on the LAST bar of an atmospheric exit (break OR intro→build), one of three per exit
    //    (seeded): silence / rhythmic (a drum fill) / melodic (a fat bass run). The whole body already ducks on
    //    the last bar (exitDuck), so the fill stands ALONE there → distinct from both the section and the next.
    if (isExit) {
      const fill = (['silence', 'rhythmic', 'melodic'] as const)[createRng(`${track.seed}:xfill${pos}`).int(3)]
      if (fill === 'rhythmic') {
        const kv = style.kickVoice
        layers.push(orbit(`s("${lastBar('[bd ~ sd ~ bd sd [sd sd] [sd*4]]')}")${kv.bank ? `.bank("${kv.bank}")` : ''}.gain(${g(0.8)}).hpf(150).shape(0.1).lpf(7000)${fxFor(0, 0.3)}`, ORBIT.snare))
      } else if (fill === 'melodic') {
        const rt = ((chord.notes[0] % 12) + 12) % 12 + 12 * (this.config.bassOctave + 2) // a fat bass run on the last bar
        layers.push(orbit(`note("${lastBar(`[${rt} ${rt} ${rt + 7} ${rt} ${rt + 10} ${rt + 7} ${rt + 3} ${rt}]`)}").s("supersaw").unison(3).detune(0.4).clip(0.95).lpf(1100).distort("1.5:0.4").gain(${g(0.5)})${pump}`, ORBIT.bass))
      }
      // 'silence' → nothing added; the ducks leave a clean gap before the drop.
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

  /** Subtle, in-key background texture to fill/dilute the track — PARAMETERISED per track by `v` (register via
   *  `root`, plus struct rotation / timbre jitter / filter / pan) so a repeated kind never sounds identical. */
  private bgTexture(kind: BgKind, root: number, g: (x: number) => number, fxFor: (d: number, r: number) => string, v: BgVary): string {
    switch (kind) {
      // ── drones / hums (BEDS) — register shifts via `root`; a cutoff jitter varies the colour ──────────
      case 'drone':     return `note("${root - 12}").s("sawtooth").attack(1).release(6).lpf(${Math.round(420 * v.cut)}).gain(${g(0.11)})${fxFor(0.1, 0.5)}`
      case 'hum':       return `note("${root - 12}").s("sawtooth").detune(0.06).unison(2).lpf(${Math.round(300 * v.cut)}).gain(${g(0.1)})`
      case 'tremdrone': return `note("${root - 12}").s("sawtooth").attack(1).release(6).lpf(${Math.round(400 * v.cut)}).gain(${g(0.12)}).gain(sine.slow(6).range(0.72, 1))`
      case 'organ':     return `note("[${root - 12},${root - 5}]").s("sine").attack(0.5).release(5).gain(${g(0.1)})${fxFor(0.1, 0.5)}`
      case 'sweepdrone':return `note("${root - 12}").s("sawtooth").attack(1).release(6).lpf(sine.range(250, 900).slow(24)).gain(${g(0.11)})`
      // ── pulses / beepers (ACCENTS) — rotate the struct (moves the hit), jitter timbre, vary the pan ────
      case 'subpulse':  return `note("${root - 12}").struct("${rotStruct('x ~ x ~', v.rot)}").s("sine").attack(0.04).release(0.5).lpf(180).gain(${g(0.16)})`
      case 'sonar':     return `note("${root + 24}").struct("${rotStruct('x ~ ~ ~ ~ ~ ~ ~', v.rot)}").s("sine").decay(${r2(0.4 * v.jitter)}).gain(${g(0.12)})${fxFor(1, 1)}.pan(${v.pan})`
      case 'metallic':  return `note("${root + 19}").struct("${rotStruct('~ ~ ~ ~ x ~ ~ ~', v.rot)}").s("sine").fm(${r2(8 * v.jitter)}).fmh(3.3).decay(0.25).gain(${g(0.05)})${fxFor(0.9, 0.9)}.pan(${v.pan})`
      case 'morse':     return `note("${root + 12}").struct("${rotStruct('x x ~ x ~ ~ x ~', v.rot)}").s("square").decay(0.05).lpf(${Math.round(2000 * v.cut)}).gain(${g(0.11)})${fxFor(0.6, 0.4)}.pan(${v.pan})`
      case 'bell':      return `note("${root}").struct("${rotStruct('x ~ ~ ~ ~ ~ ~ ~', v.rot)}").s("sine").fm(${r2(3 * v.jitter)}).fmh(1.4).decay(${r2(2 * v.jitter)}).gain(${g(0.08)})${fxFor(0.8, 1.2)}.pan(${v.pan})`
      // ── noise textures (BEDS) ─────────────────────────────────────────────────────────────────────────
      case 'wind':      return `s("white*8").dec(0.5).lpf(sine.range(300, 1100).slow(16)).hpf(220).gain(${g(0.07)}).pan(sine.slow(11))`
      case 'crackle':   return `s("white*16").dec(0.01).degradeBy(0.7).hpf(1500).lpf(${Math.round(5000 * v.cut)}).gain(${g(0.09)}).pan(sine.slow(9))`
      case 'hiss':      return `s("white*4").dec(0.4).hpf(${Math.round(3000 * v.cut)}).gain(${g(0.1)}).pan(sine.slow(13))`
      case 'geiger':    return `s("white*16").dec(0.005).degradeBy(0.82).hpf(4000).gain(${g(0.1)}).pan(rand)`
      case 'resonance': return `note("${root + 12}").s("sawtooth").lpf(${Math.round(900 * v.cut)}).lpq(16).gain(${g(0.05)})${fxFor(0.4, 0.7)}`
      // ── tonal shimmers (sinearp = ACCENT — rotate the arp order) ──────────────────────────────────────
      case 'sinearp':   return `note("${rotStruct(`${root} ${root + 3} ${root + 7} ${root + 10}`, v.rot)}").slow(2).s("sine").decay(${r2(0.3 * v.jitter)}).gain(${g(0.15)})${fxFor(0.7, 0.8)}.pan(${v.pan})`
      case 'granular':  return `s("white*16").dec(0.02).speed("<1 2 0.5 1.5>").hpf(2000).gain(${g(0.1)}).pan(rand)`
      case 'choir':     return `note("[${root - 12},${root - 9},${root - 5}]").s("sawtooth").attack(1.2).release(5).lpf(${Math.round(600 * v.cut)}).gain(${g(0.06)})${fxFor(0.3, 1.4)}`
      case 'siren':     return `note("${root + 7}").add(note(sine.slow(12).range(-0.3, 0.3))).s("sine").lpf(${Math.round(800 * v.cut)}).gain(${g(0.14)})${fxFor(0.4, 1)}.pan(${v.pan})`
      // ── co-designed dark/horror (docs/radio-part-archetypes.md) — beds + the deepBell accent ─────────────
      case 'tapeChoir':   return `note("[${root - 12},${root - 9},${root - 5}]").s("sawtooth").vowel("<aa oo aa ee>").attack(1.5).release(4).add(note(perlin.range(-0.25, 0.25).slow(3))).crush(7).lpf(${Math.round(1700 * v.cut)}).hpf(220).gain(${g(0.14)})${fxFor(0.8, 1.4)}.pan(${v.pan})`
      case 'droneCluster':return `note("[${root - 12},${root - 6},${root + 1}]").s("sawtooth").attack(2).release(6).lpf(sine.range(180, 800).slow(10)).lpq(7).fm(1.2).fmh(2.51).distort("1.1:0.25").gain(${g(0.14)})${fxFor(0.5, 1)}.pan(${v.pan})`
      case 'scanner':     return `s("white*4").dec(2).attack(0.5).hpf(300).lpf(sine.range(400, 3000).slow(6)).lpq(20).gain(${g(0.14)}).pan(sine.slow(9))`
      case 'tapeWarble':  return `note("${root - 12}").s("sawtooth").attack(1).release(6).add(note(sine.range(-0.4, 0.4).slow(1.5))).lpf(${Math.round(700 * v.cut)}).crush(8).gain(${g(0.1)})${fxFor(0.4, 0.8)}.pan(${v.pan})`
      case 'insectoid':   return `s("white*32").dec(0.008).degradeBy(0.5).speed(perlin.range(0.8, 2.5).fast(4)).hpf(5000).lpf(perlin.range(6000, 12000).fast(2)).gain(${g(0.13)}).pan(rand)`
      case 'deepBell':    return `note("${root - 12}").struct("${rotStruct('x ~ ~ ~ ~ ~ ~ ~', v.rot)}").s("sine").fm(${r2(2.5 * v.jitter)}).fmh(1.41).attack(0.001).decay(3).lpf(1400).distort("1.05:0.2").gain(${g(0.2)})${fxFor(0.9, 1.4)}.pan(${v.pan})`
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

// Drum GROOVE kits (co-designed — docs/radio-part-archetypes.md). 1-BAR patterns so they fit the kick block's
// fill-wrapping. The user's taste runs BROKEN/SYNCOPATED (amen/broken won) over straight 4-floor. `kick` = base
// kick pattern; `hat`/`snare`/`clap` = those layers' patterns; `ghost` = an extra quiet snare layer (amen rattle);
// `rim` = a dubby off-pulse (minimal); `shape`/`lpf` tweak the kick; `swing` the hats. (Drums MAY rest — no
// no-silence rule here.) 'existing' (the original 4-floor techno) is NOT in this map — it keeps the per-element style fields.
interface DrumKit { kick: string; shape?: number; lpf?: string; hat: string; snare: string; clap: string; ghost?: string; rim?: string; swing: number }
const DRUM_KITS: Record<Exclude<DrumArchetype, 'existing'>, DrumKit> = {
  amen: { kick: 'bd ~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~', hat: 'hh*16', snare: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd ~', clap: '~ cp ~ cp', ghost: '~ ~ sd ~ ~ sd ~ ~ ~ sd ~ ~ ~ sd ~ ~', swing: 0.06 },
  industrial: { kick: 'bd*4', shape: 0.3, hat: 'white*16', snare: '~ cp ~ cp', clap: '~ cp ~ cp', swing: 0 },
  broken: { kick: 'bd ~ ~ bd ~ ~ bd ~ ~ bd ~ bd ~ ~ bd ~', hat: 'hh*16', snare: '~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ cp', clap: '~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ cp', swing: 0.13 },
  minimal: { kick: 'bd*4', lpf: '.lpf(2200)', hat: '~ hh ~ hh', snare: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', clap: '~ cp ~ cp', rim: '~ rim ~ rim', swing: 0 },
}

// Per-archetype bass CORE (the co-designed dark/electronic tournament winners — docs/radio-part-archetypes.md).
// `off` = 16-step OFFSET pattern relative to the section root (0 = root, 6 = tritone…; no bare `~` — the BASS LAW
// forbids silence, gaps are `_` sustains or ghost notes). `src` = source+synth, `fx` = character chain. Optional:
// `shove` (per-bar transpose), `drift` (continuous downward pitch slide), `filt` (filter override, else the shared
// entry sweep). The composer appends `.add(note("<roots>"))` so each rides the progression root per bar.
interface BassVoice { off: string; src: string; fx: string; shove?: string; drift?: (n: number, la: string) => string; filt?: (n: number, la: string) => string }
const BASS_VOICES: Record<Exclude<BassArchetype, 'existing'>, BassVoice> = {
  rootPulse: { off: '0*16', src: '.s("supersaw").unison(5).detune(0.4)', fx: '.acidenv(0.7).lpq(9).distort("1.2:0.3")' },
  bitcrush: { off: '0 0 0 6 0 0 0 0 0 0 6 0 5 0 0 0', src: '.s("supersaw").unison(3).detune(0.4)', fx: '.crush(4).distort("1.3:0.45").release(0.14).lpq(5).acidenv(0.4).gain("1 0.45 0.6 0.5 1 0.45 0.6 0.5 1 0.45 0.7 0.5 1 0.45 0.6 0.5")' },
  wobble: { off: '0 0 0 0 0 0 6 0 0 0 0 0 0 0 5 0', src: '.s("supersaw").unison(5).detune(0.5)', fx: '.lpq(13).distort("1.4:0.45")', filt: (n, la) => `.lpf(sine.range(160, 1700).slow(${Math.max(2, n)})${la})` },
  chromaDescent: { off: '0*16', src: '.s("supersaw").unison(5).detune(0.45).fm(2).fmh(2.51)', fx: '.lpq(6).distort("1.4:0.45").gain("1 0.5 0.7 0.5 1 0.5 0.7 0.5 1 0.5 0.7 0.5 1 0.5 0.7 0.5")', drift: (n, la) => `.add(note(saw.range(0, -12).slow(${n})${la}))`, filt: (_n, la) => `.lpf(saw.range(200, 1100).slow(2)${la})` },
  pulseHorror: { off: '0*16', shove: '.add(note("<0 0 6 0>"))', src: '.s("supersaw").unison(3).detune(0.4)', fx: '.ply("<1 1 2 1 1 3 1 2>").crush("<8 5 8 4>").distort("1.5:0.5").lpq(7).gain("1 0.5 0.7 0.5 1 0.5 0.7 0.6 1 0.5 0.8 0.5 1 0.5 0.7 0.6")', filt: () => '.lpf(perlin.range(220, 1700).fast(2))' },
  tritone: { off: '0 _ _ 6 _ _ 0 _ 6 _ 5 _ 4 _ 0 _', src: '.s("sine").fm(4).fmh(2.49)', fx: '.lpq(7).acidenv(0.45).distort("1.6:0.5")' },
}

// Per-archetype synth+FX chain (the co-designed lead set — docs/radio-lead-archetypes.md). `src` overrides the
// source (omit → use the track's voice); `fx` is the character chain; `filt` overrides the entry-sweep filter;
// `ceil` raises the filter ceiling for bright timbres; `fat` adds the octave-down shadow; `lvl` scales the gain.
interface LeadVoiceSpec { src?: string; fx: string; ceil?: number; fat?: boolean; filt?: string; lvl?: number }
const LEAD_VOICES: Record<LeadVoiceId, LeadVoiceSpec> = {
  // — existing —
  arpDyad: { fx: '.acidenv(0.5).lpq(4).attack(0.012).dec(0.12).delay(0.13).delaytime(0.25).delayfeedback(0.3).room(0.5).roomsize(8).asym("1:0.9").hpf(200)', fat: true },
  atmoDyad: { fx: '.lpq(7).attack(0.02).dec(0.4).delay(0.6).delaytime(0.375).delayfeedback(0.7).room(0.6).roomsize(7).hpf(180)', fat: true },
  // — neutral (track voice) —
  chordStab: { fx: '.lpq(5).dec(0.16).delay(0.3).delaytime(0.1875).delayfeedback(0.5).room(0.4).roomsize(6)', ceil: 1700, lvl: 1.1 },
  lament: { fx: '.lpq(6).attack(0.01).dec(0.22).delay(0.6).delaytime(0.375).delayfeedback(0.68).room(0.58).roomsize(7)', ceil: 1700, fat: true },
  callResponse: { fx: '.lpq(6).attack(0.01).dec(0.2).delay(0.55).delaytime(0.375).delayfeedback(0.66).room(0.5).roomsize(7)', ceil: 1800, fat: true },
  octavePulse: { fx: '.acidenv(0.55).lpq(9).dec(0.15).attack(0.005).delay(0.4).delaytime(0.1875).delayfeedback(0.52).room(0.4).roomsize(6)', ceil: 2000, fat: true },
  doubleStop: { fx: '.lpq(5).attack(0.01).dec(0.32).delay(0.5).delaytime(0.375).delayfeedback(0.66).room(0.6).roomsize(7)', ceil: 1700 },
  leadingTone: { fx: '.lpq(6).attack(0.01).dec(0.2).delay(0.55).delaytime(0.375).delayfeedback(0.66).room(0.55).roomsize(7)', ceil: 2400, fat: true },
  phrygianHalf: { src: '.s("square")', fx: '.lpq(7).attack(0.01).dec(0.18).delay(0.5).delaytime(0.375).delayfeedback(0.64).room(0.52).roomsize(7)', ceil: 1900, fat: true },
  tritone: { fx: '.lpq(7).attack(0.01).dec(0.2).delay(0.5).delaytime(0.375).delayfeedback(0.64).room(0.55).roomsize(7)', ceil: 1900, fat: true },
  // — dictated timbres —
  bellMelody: { src: '.s("sine").fm(2.5).fmh("<2 1.5 3 2>").attack(0.004).decay(0.55)', fx: '.lpq(2).delay(0.5).delaytime(0.375).delayfeedback(0.62).room(0.7).roomsize(8)', ceil: 2400 },
  glassArp: { src: '.s("sine").fm(1.6).fmh("<2 3 2 4>").attack(0.002).decay(0.16)', fx: '.lpq(2).delay(0.5).delaytime(0.375).delayfeedback(0.66).room(0.78).roomsize(9)', ceil: 3600, lvl: 0.85 },
  ghostVoice: { src: '.s("sawtooth").vowel("<a e o aa>")', fx: '.lpq(2).attack(0.05).release(0.45).delay(0.5).delaytime(0.375).delayfeedback(0.62).room(0.72).roomsize(8)', ceil: 2000 },
  stutterStab: { src: '.s("square").ply("<1 1 2 1 3 1>")', fx: '.lpq(6).dec(0.11).attack(0.004).delay(0.3).delaytime(0.1875).delayfeedback(0.5).room(0.4).roomsize(6)', ceil: 1900, fat: true },
  glitchStorm: { src: '.s("square").ply("<1 2 1 1 2 1 3 1>").degradeBy(0.25).sometimesBy(0.25, x => x.add(note(12))).distort("2.5:0.4")', fx: '.lpq(9).dec(0.07).delay(0.18).delaytime(0.125).delayfeedback(0.45).room(0.3).roomsize(5)', filt: '.lpf(perlin.range(500, 3000).fast(2))' },
  detunedDrift: { src: '.s("supersaw").unison(7).detune(0.6).add(note(perlin.range(-0.4, 0.4).slow(2))).attack(0.25).release(1.6)', fx: '.lpq(4).delay(0.4).delaytime(0.5).delayfeedback(0.6).room(0.66).roomsize(8)', filt: '.lpf(saw.range(450, 1500).slow(8))', lvl: 0.95 },
  warpedBox: { src: '.s("sine").fm(3).fmh(7).attack(0.001).decay(0.4).add(note(sine.range(-0.15, 0.15).slow(1.5))).crush(6)', fx: '.delay(0.3).delaytime(0.375).delayfeedback(0.5).room(0.72).roomsize(9)', filt: '.lpf(2600)' },
  crushBell: { src: '.s("square").fm(2).fmh(4).attack(0.001).decay(0.2).crush(4).speed("<1 1 0.98 1>")', fx: '.delay(0.3).delaytime(0.1875).delayfeedback(0.5).room(0.5).roomsize(7)', filt: '.lpf(3000)' },
}
function r2(nn: number): number { return Math.round(nn * 100) / 100 }

// Per-track variation applied to a bg texture so a repeated kind never sounds identical (de-fingerprinting):
// a register shift (octaves → stays in key), a struct rotation (moves a rhythmic hit), a timbre jitter
// (fm/decay) and a filter/pan position. Derived from a track-stable seed so it's steady within a track.
interface BgVary { oct: number; rot: number; jitter: number; pan: number; cut: number }
function bgVary(rng: Rng): BgVary {
  return {
    oct: [-12, 0, 0, 12][rng.int(4)],
    rot: rng.int(8),
    jitter: r2(0.8 + rng.next() * 0.5), // 0.8..1.3
    pan: r2(0.3 + rng.next() * 0.4),    // 0.3..0.7
    cut: r2(0.75 + rng.next() * 0.6),   // 0.75..1.35
  }
}
/** Rotate a space-separated struct pattern by n steps (moves the hit to a different beat). */
function rotStruct(pat: string, n: number): string {
  const a = pat.split(' ')
  const k = ((n % a.length) + a.length) % a.length
  return a.slice(k).concat(a.slice(0, k)).join(' ')
}
