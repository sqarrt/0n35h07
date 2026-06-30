import { createRng, randomSeed, type Rng } from '../seededRandom'
import type { RadioBanks, MoodConfig } from './banks'
import type { RadioConfig } from './radioConfig'
import { AntiRepeatBuffer } from './AntiRepeatBuffer'
import { RhythmEngine } from './engines/RhythmEngine'
import { MelodyEngine, initialLeadState, type LeadState, type LeadVoiceId } from './engines/MelodyEngine'
import { descCadence, descSubRun } from './engines/leadMelody'
import { kickColorChain } from './engines/drumColor'
import { BassEngine } from './engines/BassEngine'
import { rollMutations } from './MutationEngine'
import { disguiseCells } from './seqDisguise'
import { TimbreEngine, initialDrift, type DriftState } from './engines/TimbreEngine'
import { CompositionScheduler, type TrackPlan } from './CompositionScheduler'
import { shapeFor, type SectionRole, type SectionShape } from './arrangement'
import type { PercKind, BgKind, BassArchetype, DrumArchetype, TrackStyle } from './trackStyle'
import { keyRootMidi, type Chord, type ChordSequence } from './theory'
import type { MusicalState } from './MusicalState'
import type { TrackDescriptor } from '../../trackDescriptor'
import { sidechainGain } from './fx'

export interface RadioComposerDeps { banks: RadioBanks; config: RadioConfig }

const ORBIT = { kicks: 2, perc: 3, bass: 4, pad: 5, lead: 6, snare: 7, fx: 8, arp: 9 } as const

// ── GLOBAL MIX ───────────────────────────────────────────────────────────────────────────
// The ONE place the balance of every role is set. These levels are FIXED — they do NOT
// depend on the track, mood or random drift, so the mix sounds the same in every composition
// (only a gentle, uniform section-energy envelope scales them all together). Kick is the loud
// reference; lead sits well under it; bg is near-subliminal.
const MASTER = 0.92
const MIX = {
  kick: 0.9,
  bass: 0.58,   // bumped 0.5→0.58: the bass still read too quiet on some tracks
  sub: 0.47,
  lead: 0.12,   // leads sit WELL under the groove (used less than bass, just above bg) — never pierce
  bgScale: 0.18, // multiplies each bg texture's own (already small) level. 0.27→0.18: bg still pierced on exposed
                 // intros (normScale only TRIMS, so a sparse intro never trims the bed AND nothing masks it).
  bgCap: 0.09,  // HARD ceiling on a bg texture's pre-scale level (0.15→0.09 — clamps the loudest textures hard)
  bgGainCeil: 0.022, // ABSOLUTE final-gain ceiling for any bg layer → it can never blast, whatever the norm does
  hat: 0.34,
  snare: 0.46,
  clap: 0.4,
  perc: 0.3,
  fx: 0.4,      // transition devices / risers / riser texture
} as const

// Section-shaping curves (hand-tuned by ear; FLOOR = value at energy 0, SPAN = added by energy 1).
const BRIGHT_FLOOR = 0.4, BRIGHT_SPAN = 0.6      // filter brightness vs section energy
const ENERGY_FLOOR = 0.83, ENERGY_SPAN = 0.17    // uniform loudness envelope vs energy (raised floor so quiet sections aren't too quiet)
const EASE_IN_FLOOR = 0.18, EASE_IN_SPAN = 0.82  // gain ramp for a layer re-entering after silence (rises to 1.0)
const NORM_TARGET = 0.8   // loudness-normalisation target for a FULL section (only ever trims, never boosts)

/** Loudness policy for one section: the per-part gain `g` (MASTER × level × energy-envelope × normalisation)
 *  and the sidechain `pump`. NB: the KICK does NOT use `g` — it keeps its own energy curve (see the kick layer),
 *  which is why normScale only trims the OTHER parts toward NORM_TARGET. */
function makeLoudness(
  shape: SectionShape, energy: number, peak: boolean, mood: MoodConfig,
): { g: (level: number) => number; pump: string; energyEnv: number } {
  const energyEnv = ENERGY_FLOOR + ENERGY_SPAN * energy
  const partSq = (shape.layers.bass ? MIX.bass * MIX.bass + MIX.sub * MIX.sub : 0)
    + (shape.layers.perc ? MIX.hat * MIX.hat + MIX.snare * MIX.snare + (peak ? MIX.clap * MIX.clap : 0) : 0)
  const normScale = partSq > 0 ? Math.min(1, NORM_TARGET / Math.sqrt(partSq)) : 1
  const g = (level: number) => r2(MASTER * level * energyEnv * normScale)
  const pump = sidechainGain(mood.fx.sidechainDepth)
  // energyEnv is exposed because the KICK uses it directly (its own gain, bypassing normScale/g).
  return { g, pump, energyEnv }
}

// Transition device families (a "pre" device on the outgoing block's last bar, a "post" impact on the downbeat
// crossed into). Mirror the `as const` arrays inside buildNextPattern.
type PreKind = 'snareRoll' | 'tomRoll' | 'riser' | 'kickDrop' | 'echoThrow'
type PostKind = 'crash' | 'subDrop' | 'downlifter'

/** Everything one section's layer renderers read — computed once in buildNextPattern, then handed to each
 *  render*() method. A Parameter Object purely for READABILITY: correctness stays guarded by the byte-identity
 *  snapshot, not the type system (the renderers also read/mutate shared composer state — this.lead / this.anti /
 *  this.melody — which is reached via `this`, NOT carried here). Only fields a layer actually reads live here. */
interface SectionContext {
  track: TrackPlan
  mood: MoodConfig
  rng: Rng
  pos: number
  role: SectionRole
  shape: SectionShape
  bars: number
  n: number
  style: TrackStyle
  seq: ChordSequence
  chord: Chord
  peak: boolean
  muffled: boolean
  memory: boolean
  isExit: boolean
  blockProgress: number
  bStart: number
  lpf: number
  drums: ReturnType<RhythmEngine['buildDrums']>
  drumKit: DrumKit | null
  mut: ReturnType<typeof rollMutations>
  bassShadow: 'A' | 'B' | null
  leadShadow: 'D' | null
  bassRng: Rng
  g: (level: number) => number
  pump: string
  energyEnv: number
  fxFor: (dFactor: number, rFactor: number) => string
  seqAligned: (elems: string[]) => string
  lateAlign: string
  entered: (k: keyof SectionShape['layers']) => boolean
  bassEmph: string
  leadEmph: string
  bassEnter: string
  percEnter: string
  dropDuck: string
  exitDuck: string
  leadEntered: boolean
  leadOn: boolean
  preKind: PreKind | null
  postKind: PostKind | null
  lastN: number
  lastBar: (x: string) => string
  firstBar: (x: string) => string
  fillNext: boolean
  boundaryOut: boolean
}

export class RadioComposer {
  private readonly banks: RadioBanks
  private readonly config: RadioConfig
  private readonly anti: AntiRepeatBuffer
  private readonly rhythm: RhythmEngine
  private readonly melody: MelodyEngine
  private readonly bass: BassEngine
  private readonly timbre: TimbreEngine
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
    this.scheduler = new CompositionScheduler({ banks: this.banks, config: deps.config, sessionSeed: this.seed })
    this.drift = initialDrift(this.banks.moods[this.scheduler.current().mood])
  }

  /** Current track's compact identity (for saving to the library + the trash block id). */
  descriptor(): TrackDescriptor { return this.scheduler.descriptor() }
  currentIndex(): number { return this.scheduler.currentIndex() }

  /** Render the CURRENT track as ONE `arrange(...)` Strudel program — for copy-paste into strudel.cc and (Phase C)
   *  the playback unit. Each section is rendered at bar 0, so its `<…>` sequences start at cycle 0 (`arrange` restarts
   *  every segment there — the global-offset rotation is moot). Labelled with a header + per-segment comments.
   *  Advances this composer, so callers use a throwaway instance. */
  renderArrangedTrack(): { program: string; totalBars: number; bpm: number } {
    const d = this.scheduler.descriptor()
    const startIndex = this.scheduler.currentIndex()
    const parts: string[] = []
    let totalBars = 0
    let guard = 0
    while (this.scheduler.currentIndex() === startIndex && guard++ < 64) {
      this.bar = 0   // arrange restarts each segment at cycle 0 → neutralise the global-offset rotation
      const { strudelCode, musicalState } = this.buildNextPattern()
      const stack = strudelCode.replace(/^setcpm\([^)]*\)\n/, '')   // one setcpm for the whole track, not per section
      parts.push(`  // ${musicalState.section} (${musicalState.sectionBars} bars)\n  [${musicalState.sectionBars}, ${stack}],`)
      totalBars += musicalState.sectionBars
    }
    const header = `// ${d.seed} · ${d.mood} · ${d.key} ${d.scaleName} · ${d.bpm}bpm`
    const program = `setcpm(${d.bpm}/4)\n${header}\narrange(\n${parts.join('\n')}\n)`
    return { program, totalBars, bpm: d.bpm }
  }

  /** The arrange program string only (for copy-paste into strudel.cc). Advances the composer — throwaway instance. */
  renderArranged(): string { return this.renderArrangedTrack().program }

  /** Jump to a track index within the current session seed (deterministic). Resets per-track state. */
  jumpTo(index: number): void { this.scheduler.jumpTo(index); this.resetTrackState() }

  /** Replay tracks from a DIFFERENT session seed (a saved favorite): rebuild the scheduler, then jumpTo. */
  reseed(seed: string): void {
    this.seed = seed
    this.scheduler = new CompositionScheduler({ banks: this.banks, config: this.config, sessionSeed: seed })
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

  /** Gather everything one section needs — harmony, arc role, mix policy, fx, ducks, transition devices — into the
   *  SectionContext the layer renderers read. Mutates per-section composer state (this.bar gap accounting,
   *  this.drift, the locked per-track kit) exactly as the inline code did; order is load-bearing. */
  private computeSectionContext(): SectionContext {
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
    // SECTION ALIGNMENT is gone: sections are arranged (each starts at cycle 0 via arrange()), so a `<a b c d>`
    // already plays element 0 first and an n-bar `.slow(n)` LFO is already phase-aligned — no global-offset rotation
    // is needed. `seqAligned` is now just the `<…>` wrapper, and `lateAlign` is an empty no-op (kept so the layer
    // code that appends it reads unchanged).
    const lateAlign = ''
    const seqAligned = (elems: string[]): string => `<${elems.join(' ')}>`
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
    const rampVals = Array.from({ length: rampN }, (_, i) => r2(EASE_IN_FLOOR + EASE_IN_SPAN * (i + 1) / rampN))
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

    const bright = BRIGHT_FLOOR + BRIGHT_SPAN * energy
    const lpf = Math.round(this.drift.lpf * bright)
    // GLOBAL balance: level = MASTER × role-level × a gentle, UNIFORM section-energy envelope.
    // No drift.gain, no mood.density — so the balance can't shift track-to-track. energyEnv
    // scales every role together (intros softer, peaks fuller) WITHOUT changing their ratios.
    // Raised floor (was 0.74 + 0.26·energy) so the low-energy sections (intro/break/outro) sit a bit LOUDER —
    // they read as quiet without being too quiet; peaks (energy≈0.94) barely move.
    // Loudness policy: per-part gain `g` + sidechain `pump` (the kick keeps its own curve — see makeLoudness).
    const { g, pump, energyEnv } = makeLoudness(shape, energy, peak, mood)
    // Every part draws echo/reverb from the track's ONE fx space (scaled by role), so
    // parts cohere — no dry bass under a wet lead. dFactor/rFactor = this part's share.
    const fx = style.fx
    const fxFor = (dFactor: number, rFactor: number): string => {
      const dly = r2(Math.min(0.85, fx.delay * dFactor * mut.delay))
      const rm = r2(Math.min(0.85, fx.room * rFactor * mut.room))
      return (dly > 0.02 ? `.delay(${dly}).delaytime(${fx.delayTime}).delayfeedback(${r2(Math.min(0.82, fx.delayFb * mut.delay))})` : '')
        + (rm > 0.02 ? `.room(${rm}).roomsize(${fx.roomSize})` : '')
    }
    // Bass riff is LOCKED per movement; the 2nd movement (after break) gets a new riff.
    const bassRng = createRng(`${track.seed}:bass${this.afterBreak ? '2' : ''}`)

    // ── SECOND-VOICE LAYERS (Switch-Angel) — a track may grow a quiet shadow voice on its bass and/or its lead so
    //    the overlap births a melody neither part plays alone. Decided per-TRACK (stable across sections via the
    //    track seed): ~60% chance each, then a strategy — bass A=ghost counter-line / B=transposed superimpose;
    //    lead C=diatonic-third .off canon / D=independent second phrase. null = no shadow this track.
    const SHADOW_PROB = 0.6
    const shadowRng = createRng(`${track.seed}:shadow`)
    const bassShadow: 'A' | 'B' | null = shadowRng.next() < SHADOW_PROB ? (shadowRng.next() < 0.5 ? 'A' : 'B') : null
    // Per-track MUTATIONS — 3-4 parameters nudged from default within safe bounds (uniqueness; see MutationEngine).
    const mut = rollMutations(track.seed)
    // GUARDRAIL: a fixed-semitone interval on absolute notes makes parallel OUT-OF-KEY clashes (a fixed minor-3rd is
    // NOT the diatonic 3rd on most degrees → the "off sounds awful" regression). So the lead shadow is the
    // independent in-scale phrase (D) only; the third-canon (C) is parked until it's built diatonically (degree-based).
    const leadShadow: 'D' | null = shadowRng.next() < SHADOW_PROB ? 'D' : null

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

    const ctx: SectionContext = {
      track, mood, rng, pos, role, shape, bars, n, style, seq, chord,
      peak, muffled, memory, isExit, blockProgress, bStart, lpf, drums, drumKit, mut,
      bassShadow, leadShadow, bassRng, g, pump, energyEnv, fxFor, seqAligned, lateAlign, entered,
      bassEmph, leadEmph, bassEnter, percEnter, dropDuck, exitDuck, leadEntered, leadOn,
      preKind, postKind, lastN, lastBar, firstBar, fillNext, boundaryOut,
    }
    return ctx
  }

  buildNextPattern(): { strudelCode: string; musicalState: MusicalState } {
    const ctx = this.computeSectionContext()
    const { track, pos, role, shape, bars, chord } = ctx

    // Each instrument renders its own fragment(s); concatenated in MIX order (kick → glue → perc → bass → bg →
    // lead → break → exit-fill). The order is part of the byte-identity contract — do not reshuffle.
    const layers: string[] = [
      ...this.renderKick(ctx),
      ...this.renderTransitionDevices(ctx),
      ...this.renderPerc(ctx),
      ...this.renderBass(ctx),
      ...this.renderBg(ctx),
      ...this.renderLead(ctx),
      ...this.renderBreak(ctx),
      ...this.renderExitFill(ctx),
    ]

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

  /** KICK — the loud global reference that drives the whole balance. Composition-independent; keeps its OWN energy
   *  curve (bypasses normScale/g, by design) and takes the ducks but no pump/fx. */
  private renderKick(ctx: SectionContext): string[] {
    const { shape, role, style, preKind, boundaryOut, fillNext, lastN, seqAligned, peak, muffled, energyEnv, drums, dropDuck, exitDuck } = ctx
    const out: string[] = []
    if (shape.layers.kicks) {
      const deep = role === 'break' // steady, darker kick that holds the rest together
      const base = deep ? 'bd*4' : style.drumRhythm.kick   // note 8: groove from the РИСУНОК axis
      let kickPat = base
      // The fill/drop must land on the section's LAST bar → seqAligned (and `[base]` keeps a multi-token
      // pattern like "bd ~ bd bd" as one bar so the !-repeat can't bind to its last token).
      if (preKind === 'kickDrop') kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~']) // drop the last bar
      else if (boundaryOut) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), fillNext ? '[bd*2 bd bd bd]' : '[bd bd bd bd]'])
      // break: cut the kick on the FINAL bar so the riser/roll peak alone fills the gap.
      else if (deep) kickPat = seqAligned([...Array(lastN).fill(`[${base}]`), '~'])
      // note 8 ЦВЕТ axis: the per-track kick colour (shape/drive/decay/lpf/click) is the BASE; the section adds a
      // peak saturation bump + a muffle/deep filter override AROUND it. Kick is the loud global mix reference.
      const PEAK_SHAPE_BUMP = 0.12
      const colour = kickColorChain(style.drumColor)
      const kickShape = r2(style.drumColor.kickShape + (peak ? PEAK_SHAPE_BUMP : 0))
      const kickGain = r2(MASTER * MIX.kick * energyEnv * (muffled ? 0.85 : deep ? 0.92 : 1))
      const sectionLpf = deep ? '.lpf(1500)' : muffled ? '.lpf(900)' : '' // section override on top of the colour
      const kit = style.drumKit   // note 8 НАБОР axis: the kit bank
      const kvoice = (kit.kickBank ? `.bank("${kit.kickBank}")` : '') + `.n(${kit.kickN})`
      out.push(orbit(`s("${kickPat}")${kvoice}.gain("${drums.gain}")${colour}.shape(${kickShape}).gain(${kickGain})${sectionLpf}${dropDuck}${exitDuck}`, ORBIT.kicks))
    }
    return out
  }

  /** BACKGROUND — a subtle, in-key texture (drone / sub-pulse / sonar ping / wind / metallic / hum) that just fills
   *  and dilutes the track. A subliminal BED always, plus an occasional distinctive ACCENT; each parameterised per
   *  track so a repeated kind never sounds identical. Near-subliminal in every track (capped + scaled). */
  private renderBg(ctx: SectionContext): string[] {
    const { shape, chord, g, fxFor, style, exitDuck, track } = ctx
    const out: string[] = []
    if (shape.layers.bg) {
      const rootPc = ((chord.notes[0] % 12) + 12) % 12 + 36 // tonic, low register
      // bg textures carry their own (small) levels; CAP each (so the louder textures can't pierce)
      // then scale them ALL by MIX.bgScale → background stays near-subliminal in every track.
      const gBg = (x: number) => Math.min(MIX.bgGainCeil, g(MIX.bgScale * Math.min(x, MIX.bgCap)))
      // Two-tier bg (de-fingerprinting): a subliminal BED always, plus an occasional distinctive ACCENT.
      // Each is PARAMETERISED per-track (register / struct rotation / timbre / pan) so even a repeated kind is
      // never identical — what made a bell or sonar "jump out" when it recurred.
      const bedV = bgVary(createRng(`${track.seed}:bg`))
      out.push(orbit(this.bgTexture(style.bg, rootPc + bedV.oct, gBg, fxFor, bedV) + exitDuck, ORBIT.fx))
      if (style.bgAccent) {
        const accV = bgVary(createRng(`${track.seed}:bgacc`))
        out.push(orbit(this.bgTexture(style.bgAccent, rootPc + accV.oct, gBg, fxFor, accV) + exitDuck, ORBIT.fx))
      }
    }
    return out
  }

  /** BASS — one of 7 CHARACTERS (style.bassArchetype): the original 303 acid riff, or a co-designed dark/electronic
   *  winner. All follow the progression root per bar (.add(note("<roots>"))), never go silent, and share the entry
   *  filter sweep + gain/pump/ducks. Plus the constant sub-sine and the optional ghost-bass shadow. */
  private renderBass(ctx: SectionContext): string[] {
    const { shape, seq, blockProgress, muffled, entered, n, lateAlign, bassShadow, style, track, mut, bassRng, role, g, fxFor, pump, bassEmph, bassEnter, dropDuck, exitDuck, pos, mood, seqAligned } = ctx
    const out: string[] = []
    if (shape.layers.bass) {
      const roots = seq.map((c) => ((c.notes[0] % 12) + 12) % 12 + 12 * (this.config.bassOctave + 1))
      // filter breathes within the section (.slow) AND its ceiling opens over the block; on ENTRY it sweeps up
      // from near-CLOSED (90Hz) so the bass eases in tonally. .late aligns the sweep to the section's first bar.
      const ceil = Math.round(560 + (0.35 + 0.65 * blockProgress) * (muffled ? 400 : 1000))
      const bassLpf = entered('bass')
        ? `saw.range(90, ${ceil}).slow(${n})${lateAlign}`
        : `saw.range(${muffled ? 240 : 420}, ${ceil}).slow(${n})${lateAlign}`
      // layer B — a quiet fifth-up copy of the bass, 1/16 late, on a squarer timbre (a transposed shadow riff)
      const bassSuper = bassShadow === 'B' && !muffled ? '.superimpose(x => x.add(note(7)).late(0.0625).s("square").lpf(1400).gain(0.32))' : ''
      let bassMain: string
      if (style.bassArchetype === 'existing') {
        const groove = style.bassGroove.split(/\s+/).map((t) => t !== '~')
        // acid env WANDERS within the section so the squelch doesn't go stale; capped 0.65, motion per-section.
        const aRng = createRng(`${track.seed}:aenv${pos}`)
        const center = Math.min(0.6, Math.max(0.12, 0.3 + 0.25 * blockProgress + (this.drift.acidenv - 0.4) * 0.25 + mut.acidenv))
        const amp = muffled ? 0.08 : 0.16
        const aHi = r2(Math.min(0.65, center + amp)); const aLo = r2(Math.max(0.12, center - amp))
        const motion = (['rise', 'fall', 'sine', 'jump'] as const)[aRng.int(4)]
        let acidenvExpr: string
        if (motion === 'rise') acidenvExpr = `saw.range(${aLo}, ${aHi}).slow(${n})`
        else if (motion === 'fall') acidenvExpr = `saw.range(${aHi}, ${aLo}).slow(${n})`
        else if (motion === 'sine') acidenvExpr = `sine.range(${aLo}, ${aHi}).slow(${n})`
        else acidenvExpr = `"<${Array.from({ length: n }, () => r2(aLo + aRng.next() * (aHi - aLo))).join(' ')}>"`
        const frag = this.bass.buildBass({
          rng: bassRng, roots, sound: style.bassSound, rest: style.bassRest, groove,
          saturation: muffled ? 0.08 : r2((0.3 + mood.fx.saturation * 0.3) * mut.drive), acidenv: acidenvExpr,
          dec: r2(0.16 * mut.env),
        })
        const fm = style.bassFm > 0 ? `.fm(${r2(style.bassFm * mut.fm)}).fmh(2)` : ''
        const fat = muffled ? '' : '.superimpose(x => x.add(note(12)).s("square").distort("1.5:0.4").gain(0.34).lpf(1400))'
        const wide = !muffled && style.bassSound === 'supersaw' ? `.unison(5).detune(${r2(0.5 * mut.width)})` : ''
        bassMain = `${frag}${wide}.clip(0.95).lpf(${bassLpf})${fm}${fat}${bassSuper}`
      } else {
        // co-designed dark/electronic archetype, transposed onto the progression roots.
        const v = BASS_VOICES[style.bassArchetype]
        const filt = v.filt ? v.filt(n, lateAlign) : `.lpf(${bassLpf})`
        // DISGUISE the fixed melodic riff per track (cell reorder) so the bassline isn't recognizable track-to-track.
        // SKIP voices carrying a positional .gain("…") accent pattern — reordering the notes would mis-align the
        // (un-reordered) per-step accents with the pitches.
        const off = /\.gain\("/.test(v.fx) ? v.off : disguiseCells(v.off, createRng(`${track.seed}:bassdis`))
        bassMain = `note("${off}")${v.shove ?? ''}.add(note("<${roots.join(' ')}>"))${v.drift ? v.drift(n, lateAlign) : ''}${v.src}${v.fx}.clip(0.95)${filt}${bassSuper}`
      }
      // main bass yields the spotlight per-bar in peaks (bassEmph) but never goes silent; trimmed so kick/snares read
      // forward. BUT intro/build are sparse — the bass IS the event there yet reads quiet under the kick → lift it
      // (and its sub) in those exposed sections so it carries; peaks stay trimmed (lead/drums need the room).
      const BASS_EXPOSED_BOOST = 1.4
      const bassLift = (muffled || role === 'build') ? BASS_EXPOSED_BOOST : 1
      out.push(orbit(`${bassMain}${fxFor(0.2, 0.16)}.gain(${g(MIX.bass * bassLift)})${bassEmph}${bassEnter}${dropDuck}${exitDuck}${pump}`, ORBIT.bass))
      // sub-sine for FAT low weight — held CONSTANT (no emphasis dip) so the low end is
      // unbroken even when the mid-bass steps back for the lead (ducked under the kick).
      // Reinforces the bass fundamental at its OWN octave (not another octave below): the
      // main bass already sits at C1–B1, so a sub beneath that would be subsonic mud.
      out.push(orbit(`note("${seqAligned(roots.map(String))}").s("sine").gain(${g(MIX.sub * bassLift)})${bassEnter}${dropDuck}${exitDuck}.lpf(150)${pump}`, ORBIT.fx))
      // layer A — a quiet melodic ghost-bass (octave up, rest-pocked, different degrees) interlocking with the riff
      if (bassShadow === 'A') {
        const counter = this.bass.buildCounter({ rng: createRng(`${track.seed}:cbass${pos}`), roots, sound: style.bassSound })
        out.push(orbit(`${counter}${fxFor(0.2, 0.16)}.gain(${g(MIX.bass * 0.34)})${bassEnter}${dropDuck}${exitDuck}${pump}`, ORBIT.bass))
      }
    }
    return out
  }

  /** PERC — snares are the "fat" of the peak; light hats keep drive. A BREAK strips the aggressive elements
   *  (busy hats, snare rolls, aux-perc) back to a calm backbeat. */
  private renderPerc(ctx: SectionContext): string[] {
    const { shape, role, drumKit, style, g, mut, percEnter, peak, fxFor, mood, dropDuck, exitDuck } = ctx
    const out: string[] = []
    if (shape.layers.perc) {
      // breathing hats: decay wobbles via a fast triangle LFO (Switch-Angel detail). The BREAK gets a SIMPLER,
      // softer hat (a plain off-pulse instead of the track's busy pattern) so it doesn't feel aggressive there.
      const hatPat = role === 'break' ? '[hh ~]*2' : (drumKit ? drumKit.hat : style.hatPat)
      const hatGain = role === 'break' ? MIX.hat * 0.7 : MIX.hat
      const swing = Math.max(0, (drumKit ? drumKit.swing : style.swing) + mut.swing)
      const hats = `s("${hatPat}").dec(tri.fast(4).range(0.05, 0.12)).gain(${g(hatGain * mut.hats)})${percEnter}.pan(sine.slow(4))` + (swing > 0 ? `.swingBy(${r2(swing)}, 4)` : '')
      out.push(orbit(hats + dropDuck + exitDuck, ORBIT.perc))
      // No snare ROLLS in a break (the ply-doubling reads as aggressive); just the plain halved backbeat. The
      // kit's snare pattern carries the groove (amen rolls / broken claps), but a BREAK reverts to a calm backbeat.
      const snPly = role === 'break' ? 0 : peak ? 0.28 : 0.14
      const snarePat = role === 'break' ? '~ sd ~ sd' : (drumKit ? drumKit.snare : '~ sd ~ sd')
      out.push(orbit(`s("${snarePat}").sometimesBy(${snPly}, x => x.ply(2)).gain(${g(MIX.snare * (role === 'break' ? 0.5 : 1))})${percEnter}${fxFor(0, 0.35)}.shape(${r2(Math.min(0.14, mood.fx.saturation * 0.16))}).lpf(7500)${dropDuck}${exitDuck}`, ORBIT.snare))
      // a quiet GHOST-snare rattle (amen) — adds the breakbeat feel; only when the kit defines it, never in a break.
      if (drumKit?.ghost && role !== 'break') out.push(orbit(`s("${drumKit.ghost}").gain(${g(MIX.snare * 0.32)})${percEnter}.shape(0.1).lpf(6000)${dropDuck}${exitDuck}`, ORBIT.snare))
      // a dubby off-pulse RIM (minimal) — its hypnotic click with delay, when the kit defines it.
      if (drumKit?.rim && role !== 'break') out.push(orbit(`s("${drumKit.rim}").gain(${g(MIX.snare * 0.6)})${percEnter}.hpf(800).room(0.35).roomsize(8).delay(0.3).delaytime(${style.fx.delayTime}).delayfeedback(0.5)${dropDuck}${exitDuck}`, ORBIT.perc))
      // peak-only claps on the backbeat (one extra layer, eased in). SKIP when the kit's snare already plays the
      // SAME clap pattern (broken/industrial: snare === clap) — else the two stack into a doubled, ear-piercing clap.
      if (peak && !(drumKit && drumKit.snare === drumKit.clap)) {
        out.push(orbit(`s("${drumKit ? drumKit.clap : style.clapPat}").gain(${g(MIX.clap)})${percEnter}${fxFor(0, 0.3)}.shape(0.08).lpf(7500)${dropDuck}`, ORBIT.snare))
      }
      // The busy aux-perc (rim/shaker/tom…) is dropped in a BREAK — it's the main source of break "aggression";
      // the kick + simple hats + halved snare are enough to keep the rest alive.
      const perc = this.percLayer(style.perc, g)
      if (perc && role !== 'break') out.push(orbit(`${perc}${percEnter}${dropDuck}${exitDuck}`, ORBIT.perc))
    }
    return out
  }

  /** Transition GLUE around the kit: the drop-before-lead crash, the pre-device on the outgoing block's last bar,
   *  the post-impact on the downbeat crossed into, and the outro's final ring-out crash. */
  private renderTransitionDevices(ctx: SectionContext): string[] {
    const { leadEntered, seqAligned, bars, g, preKind, lastBar, fxFor, postKind, firstBar, role, track, pos } = ctx
    const out: string[] = []
    // drop-before-lead: a crash on bar 1 marks the groove SLAMMING back after the bar-0 silence.
    if (leadEntered) out.push(orbit(`s("${seqAligned(['~', 'white', ...Array(Math.max(0, bars - 2)).fill('~')])}").dec(0.8).hpf(2500).gain(${g(0.42)}).room(0.6).roomsize(8)`, ORBIT.fx))
    // pre-device — the last bar of the outgoing section
    if (preKind === 'snareRoll') out.push(orbit(`s("${lastBar('[sd*4 sd*8]')}").gain(${g(0.52)}).hpf(400).lpf(7000)${fxFor(0, 0.4)}`, ORBIT.snare))
    else if (preKind === 'tomRoll') out.push(orbit(`s("${lastBar('[lt mt lt mt lt mt lt mt]')}").gain(${g(0.5)}).room(0.2)`, ORBIT.snare))
    else if (preKind === 'riser') out.push(orbit(`s("${lastBar('white*16')}").dec(0.08).lpf(saw.range(500, 9000)).gain(saw.range(0.04, ${g(0.4)})).hpf(300)`, ORBIT.fx))
    else if (preKind === 'echoThrow') out.push(orbit(`s("${lastBar('sd')}").gain(${g(0.5)}).delay(0.82).delaytime(0.1875).delayfeedback(0.72).room(0.5).roomsize(6)`, ORBIT.fx))
    else if (preKind === 'kickDrop') out.push(orbit(`s("${lastBar('white*16')}").dec(0.08).lpf(saw.range(600, 7000)).gain(saw.range(0.03, ${g(0.32)})).hpf(400)`, ORBIT.fx))
    // post-device — the downbeat of the incoming section
    if (postKind === 'crash') out.push(orbit(`s("${firstBar('white')}").dec(0.6).hpf(3500).gain(${g(0.42)}).room(0.5).roomsize(6)`, ORBIT.fx))
    else if (postKind === 'subDrop') { const run = descSubRun(createRng(`${track.seed}:subdrop${pos}`)); out.push(orbit(`note("${firstBar(`[${run.join(' ')}]`)}").s("sine").dec(0.12).lpf(500).gain(${g(0.55)})`, ORBIT.fx)) }
    else if (postKind === 'downlifter') out.push(orbit(`s("${firstBar('white*16')}").dec(0.08).lpf(saw.range(9000, 400)).gain(saw.range(${g(0.34)}, 0.03)).hpf(300)`, ORBIT.fx))
    // OUTRO ending: a long, reverberant crash on the final bar so the track concludes
    // with a clear gesture whose tail rings out into the silent gap before the next.
    if (role === 'outro') out.push(orbit(`s("${lastBar('white')}").dec(1.2).hpf(2500).gain(${g(0.4)}).room(0.6).roomsize(8)`, ORBIT.fx))
    return out
  }

  /** LEAD — ONE locked motif per movement; variety comes from FX (filter/echo), not new notes. leadPresence thins
   *  it out ('none'/'sparse'/'full'); it RESTS every 8th peak loop to breathe; plus the optional independent shadow
   *  phrase (layer D). The composer owns level/pan/emphasis; the picked archetype owns synth+FX. */
  private renderLead(ctx: SectionContext): string[] {
    const { peak, pos, bStart, leadOn, style, role, lpf, blockProgress, entered, n, lateAlign, seqAligned, chord, mut, fxFor, g, leadEmph, pump, leadShadow, memory, rng, mood, track } = ctx
    const out: string[] = []
    // INTERMITTENT: the lead RESTS on every 8th peak loop (it does not play the whole time — Switch Angel) so it
    // breathes; the groove (bass call-and-response) carries that loop. Not on float (the lead IS the section).
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
        out.push(orbit(`${this.arp(chord, style.stabSound)}${leadDev}${mut.leadFx}${fxFor(0.7, 1.2)}${fatLead}.pan(sine.slow(4)).gain(${g(leadLevel * 0.9)})${leadEmph}.lpf(${leadLpf})${pump}`, ORBIT.arp))
      } else {
        const { fragment, voice, state } = this.melody.buildLead(chord, {
          rng, leadOctave: this.config.leadOctave, density: mood.density,
          scale: track.tonality.scale, keyRoot: keyRootMidi(track.tonality.key), anti: this.anti, moodId: track.mood,
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
        out.push(orbit(`${fragment}${leadDev}${mut.leadFx}${src}${spec.fx}${filt}${fat}.pan(sine.slow(6).range(0.3, 0.7)).gain(${g(leadLevel * (spec.lvl ?? 1))})${leadEmph}`, ORBIT.lead))
      }
      // layer D — an INDEPENDENT second lead phrase (forked seed → a different melody), quiet + panned away + wet,
      // so two distinct lines weave into a richer whole. Fresh lead state so it never disturbs the main motif.
      if (leadShadow === 'D') {
        const ghost = this.melody.buildLead(chord, {
          rng: createRng(`${track.seed}:glead${pos}`), leadOctave: this.config.leadOctave, density: mood.density,
          scale: track.tonality.scale, keyRoot: keyRootMidi(track.tonality.key), anti: this.anti, moodId: track.mood,
        }, initialLeadState())
        out.push(orbit(`${ghost.fragment}.s("${style.leadSound}").lpf(2200).room(0.4).delay(0.2).pan(0.72).gain(${g(leadLevel * 0.4)})`, ORBIT.arp))
      }
    }
    return out
  }

  /** BREAK — a breakdown with its OWN melodic identity: a soft echo-tail of the outgoing lead, then a DIFFERENT
   *  restful lead developing via a slow filter bloom. No risers. */
  private renderBreak(ctx: SectionContext): string[] {
    const { role, style, firstBar, g, n, lateAlign, mood, track, exitDuck } = ctx
    const out: string[] = []
    if (role === 'break') {
      // (0) ECHO THROW — the lead riff from the peak we just left (its motif is still in
      //     this.lead, reset only at the end of this call) plays ONCE on the break's first
      //     bar, drowned in long-feedback delay + reverb so it rings out and dissolves into
      //     the breakdown — a tail of the previous part bleeding through. Continuity glue.
      const echoMotif = this.lead.motif
      if (echoMotif) {
        // Replay the movement's lead pattern ONCE on the break's first bar, drowned in long-feedback delay +
        // reverb so it rings out and dissolves — a ghostly tail of the previous part bleeding through.
        out.push(orbit(`note("${firstBar(`[${echoMotif.pattern}]`)}").s("${style.leadSound}").degradeBy(0.4).acidenv(0.4).lpq(2).attack(0.02).dec(0.12).hpf(180).delay(0.6).delaytime(${style.fx.delayTime}).delayfeedback(0.62).room(0.6).roomsize(7).gain(${g(0.26)}).lpf(1500)`, ORBIT.lead))
      }
      // (1) A DIFFERENT lead — one of the RESTFUL archetypes (the same 18-voice set as the main lead, filtered to
      //     the atmospheric ones), with its OWN timbre, picked to DIFFER from the track's main lead. Rendered LOW
      //     + echo-drowned (its own delay/room + a soft level + the last-bar exitDuck) so it rests the ears.
      //     Non-timbre voices get the break's slow filter BLOOM. (No risers; no wailing sustained pad.)
      const brkLpf = `.lpf(saw.range(500, 2000).slow(${n})${lateAlign})`
      const brk = this.melody.buildBreakLead({
        rng: createRng(`${track.seed}:brklead${this.afterBreak ? '2' : ''}`),
        leadOctave: this.config.leadOctave + 1, density: mood.density,
        scale: track.tonality.scale, keyRoot: keyRootMidi(track.tonality.key), moodId: track.mood,
      }, this.lead.motif?.voice)
      const brkSpec = LEAD_VOICES[brk.voice]
      const brkSrc = brkSpec.src ?? `.s("${style.leadSound}")`
      const brkFilt = brkSpec.filt ?? brkLpf
      out.push(orbit(`note("${brk.pattern}")${brkSrc}${brkSpec.fx}${brkFilt}.hpf(180).pan(sine.slow(6).range(0.3, 0.7)).gain(${g(0.18)})${exitDuck}`, ORBIT.lead))
    }
    return out
  }

  /** EXIT FILL — on the LAST bar of an atmospheric exit (break OR intro→build), one of three per exit (seeded):
   *  silence / rhythmic (a drum fill) / melodic (a fat bass run). The body already ducks there, so the fill stands
   *  alone — distinct from both the section and the next. */
  private renderExitFill(ctx: SectionContext): string[] {
    const { isExit, style, lastBar, g, fxFor, chord, pump, track, pos } = ctx
    const out: string[] = []
    if (isExit) {
      const fill = (['silence', 'rhythmic', 'melodic'] as const)[createRng(`${track.seed}:xfill${pos}`).int(3)]
      if (fill === 'rhythmic') {
        const kv = style.kickVoice
        out.push(orbit(`s("${lastBar('[bd ~ sd ~ bd sd [sd sd] [sd*4]]')}")${kv.bank ? `.bank("${kv.bank}")` : ''}.gain(${g(0.8)}).hpf(150).shape(0.1).lpf(7000)${fxFor(0, 0.3)}`, ORBIT.snare))
      } else if (fill === 'melodic') {
        // note 3: a SEEDED descending cadence over the track scale (was a fixed interval shape every track).
        const sc = track.tonality.scale
        const base = ((chord.notes[0] % 12) + 12) % 12 + 12 * (this.config.bassOctave + 2) // a fat bass run on the last bar
        const deg = (d: number) => base + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length)
        const run = descCadence(createRng(`${track.seed}:xfillmel${pos}`), 8).map(deg)
        out.push(orbit(`note("${lastBar(`[${run.join(' ')}]`)}").s("supersaw").unison(3).detune(0.4).clip(0.95).lpf(1100).distort("1.5:0.4").gain(${g(0.5)})${pump}`, ORBIT.bass))
      }
      // 'silence' → nothing added; the ducks leave a clean gap before the drop.
    }
    return out
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
      case 'scanner':     return `s("white*4").dec(2).attack(0.5).hpf(300).lpf(sine.range(400, 3000).slow(6)).lpq(14).gain(${g(0.07)}).pan(sine.slow(9))`
      case 'tapeWarble':  return `note("${root - 12}").s("sawtooth").attack(1).release(6).add(note(sine.range(-0.4, 0.4).slow(1.5))).lpf(${Math.round(700 * v.cut)}).crush(8).gain(${g(0.1)})${fxFor(0.4, 0.8)}.pan(${v.pan})`
      case 'insectoid':   return `s("white*32").dec(0.008).degradeBy(0.5).speed(perlin.range(0.8, 2.5).fast(4)).hpf(5000).lpf(perlin.range(6000, 12000).fast(2)).gain(${g(0.13)}).pan(rand)`
      case 'deepBell':    return `note("${root - 12}").struct("${rotStruct('x ~ ~ ~ ~ ~ ~ ~', v.rot)}").s("sine").fm(${r2(2.5 * v.jitter)}).fmh(1.41).attack(0.001).decay(3).lpf(1400).distort("1.05:0.2").gain(${g(0.2)})${fxFor(0.9, 1.4)}.pan(${v.pan})`
      // ── synthesized "foley" accents (note 5) — real-world-ish sounds modelled in pure Strudel: sparse, echoey ──
      // drip = a high sine plip with a fast downward chirp; steps = a heel→toe scuff (two shaped noise hits over a
      // low body thump); thud = a crate hitting the ground in the next room (low body + wooden knock + a bright crack).
      case 'drip':  return `note("${root + 36} ~ ~ ~ ~ ~ ~ ~ ~ ~ ${root + 36} ~ ~ ~ ~ ~").s("sine").attack(0.001).decay(${r2(0.1 * v.jitter)}).add(note(saw.range(0,-6).fast(10))).lpf(${Math.round(3800 * v.cut)}).gain(${g(0.18)}).pan(${v.pan})${fxFor(1, 1.4)}`
      case 'steps': return `stack(s("~ ~ ~ [white ~] ~ ~ ~").attack(0.004).decay(0.09).lpf(${Math.round(400 * v.cut)}).hpf(60).gain(1), s("~ ~ ~ [~ white] ~ ~ ~").attack(0.004).decay(0.06).lpf(${Math.round(290 * v.cut)}).hpf(60).gain(0.72), s("~ ~ ~ white ~ ~ ~ ~").decay(0.13).lpf(150).gain(0.9)).gain(${g(0.2)}).pan(${v.pan})${fxFor(1, 1.4)}`
      case 'thud':  return `stack(note("${root}").s("sine").attack(0.001).decay(0.22).gain(1), s("white").decay(0.07).lpf(700).hpf(180).gain(1), s("white").decay(0.012).hpf(3500).gain(0.9)).struct("${rotStruct('x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~', v.rot)}").distort("1.05:0.18").gain(${g(0.2)}).pan(${v.pan})${fxFor(0.9, 1.5)}`
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
  // — library lessons (sub+timbre stack / wavetable / heavy diode drive / cycling FM). Our sub-sine is the weight;
  //   these supply the CHARACTER layer on top, like the reference substk_* basses. —
  wtFlute: { off: '0 _ _ 6 _ 0 _ _ 5 _ _ 4 _ 0 _ _', src: '.s("wt_flute").unison(2)', fx: '.wt(0).wtenv(0.7).acidenv(0.45).distort("4:0.5").dec(0.13).lpq(2).fm("<1 ~ ~ 2>")' },
  wtDigital: { off: '0 _ 6 _ _ 0 _ 5 _ _ 4 _ _ 0 _ _', src: '.s("wt_digital").unison(2)', fx: '.wt(0).wtenv(0.5).acidenv(0.4).distort("3:0.4").dec(0.15).lpq(4)' },
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
  // — co-designed CALM/atmospheric (Silent Hill + virtual). Boosted lvl (they read quiet); fixed lpf as in the demos. —
  fogMelody: { src: '.s("triangle").attack(0.02).release(0.7).add(note(sine.range(-0.12, 0.12).slow(3)))', fx: '.delay(0.5).delaytime(0.5).delayfeedback(0.55).room(0.78).roomsize(11)', filt: '.lpf(2200)', lvl: 1.3 },
  digitalChime: { src: '.s("sine").fm(2).fmh(2.01).attack(0.005).decay(0.5)', fx: '.delay(0.4).delaytime(0.375).delayfeedback(0.6).room(0.6).roomsize(9)', filt: '.lpf(3200)', lvl: 1.15 },
  rustString: { src: '.s("sawtooth").attack(0.04).release(1.2).add(note(perlin.range(-0.15, 0.15).slow(2))).crush(10).distort("1.1:0.2")', fx: '.lpq(3).delay(0.45).delaytime(0.5).delayfeedback(0.5).room(0.7).roomsize(10)', filt: '.lpf(1400)', lvl: 1.3 },
  digitalRain: { src: '.s("triangle").fm(1.5).fmh(2.0).attack(0.002).decay(0.3)', fx: '.delay(0.5).delaytime(0.1875).delayfeedback(0.65).room(0.7).roomsize(10)', filt: '.lpf(3000)', lvl: 1.15 },
  // — PROCEDURAL random-walk leads (library lessons: acid-line + wavetable). Contour is generated fresh per track. —
  genWalk: { src: '.s("supersaw").unison(3).detune(0.3)', fx: '.acidenv(0.5).lpq(8).delay(0.3).delaytime(0.1875).delayfeedback(0.5).room(0.45).roomsize(7)', ceil: 2400, fat: true },
  genWeave: { src: '.s("wt_digital").unison(2).detune(0.2).wt(0).wtenv(0.5)', fx: '.acidenv(0.55).lpq(6).delay(0.4).delaytime(0.375).delayfeedback(0.55).room(0.6).roomsize(8)', ceil: 2200, lvl: 1.05 },
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
