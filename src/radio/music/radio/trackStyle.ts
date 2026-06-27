// Per-track "sound design": a track picks ONE combination of synth voices, drum
// patterns, extra percussion, pad mode and groove, and keeps it for its whole
// duration — so consecutive tracks differ in TIMBRE and RHYTHM, not merely in key.
// Picked with anti-repeat so track N+1 never reuses track N's choices. A deep
// option library on every axis is what stops every track sounding like one preset.
import type { Rng } from '../seededRandom'
import { weightedPick, type Weighted } from './weighted'
import { AntiRepeatBuffer } from './AntiRepeatBuffer'

export type PadMode = 'stab' | 'off' | 'drone' | 'arp'
export type PercKind = 'none' | 'rim' | 'shaker' | 'noise' | 'ride' | 'tom'
export type DropLead = 'stab' | 'arp' | 'lead'
/** How present the lead is: full (build+peak), sparse (peaks only), none (no lead — many tracks
 *  sound better without one). float sections always keep their lead regardless (it carries them). */
export type LeadPresence = 'full' | 'sparse' | 'none'
/** Subtle in-key background texture that fills/dilutes the track (no melodic pad). */
export type BgKind =
  | 'drone' | 'hum' | 'tremdrone' | 'organ' | 'sweepdrone'      // drones / hums
  | 'subpulse' | 'sonar' | 'metallic' | 'morse' | 'bell'        // pulses / beepers
  | 'wind' | 'crackle' | 'hiss' | 'geiger' | 'resonance'        // noise textures
  | 'sinearp' | 'granular' | 'choir' | 'siren'                  // tonal shimmers

export const BG_KINDS: BgKind[] = [
  'drone', 'hum', 'tremdrone', 'organ', 'sweepdrone',
  'subpulse', 'sonar', 'metallic', 'morse', 'bell',
  'wind', 'crackle', 'hiss', 'geiger', 'resonance',
  'sinearp', 'granular', 'choir', 'siren', // 'reverse' removed — a swelling white-noise burst, not in-key & too foreground
]
// Two tiers (see docs/radio-leads-lessons.md analysis): BEDS are subliminal drones/noise with no rhythmic/tonal
// HOOK — safe to recur, they don't fingerprint a track. ACCENTS are the memorable ones (a bell ping, a sonar
// blip, a morse rhythm…) — distinctive, so they're added only OCCASIONALLY and never to two near tracks.
export const BG_BEDS: BgKind[] = ['drone', 'hum', 'tremdrone', 'sweepdrone', 'organ', 'choir', 'wind', 'hiss', 'crackle', 'geiger', 'resonance', 'granular']
export const BG_ACCENTS: BgKind[] = ['subpulse', 'sonar', 'metallic', 'morse', 'bell', 'sinearp', 'siren']
const ACCENT_CHANCE = 0.28 // ~1/4 of tracks get a distinctive accent on top of the bed

/** The track's shared FX "space" — every part draws echo/reverb from THIS, scaled by
 *  its role, so all parts sit in one coherent space (no dry-bass-vs-wet-lead clash). */
export interface FxChar {
  delay: number      // base delay send (0..1)
  delayTime: string  // echo time in cycles — same for every part (locked groove)
  delayFb: number    // delay feedback
  room: number       // base reverb send (0..1)
  roomSize: number
}

export interface TrackStyle {
  bassSound: string
  bassFm: number          // 0 = clean; >0 = FM growl
  bassRest: number        // 0..1 — how holey the bassline is (groove)
  leadSound: string
  leadUnison: number      // 0 = mono; >0 = detuned stack width
  stabSound: string
  kickVoice: KickVoice   // per-track kick timbre (drum-machine / sample variant)
  kickPat: string
  clapPat: string
  hatPat: string
  perc: PercKind
  padMode: PadMode
  swing: number
  dropLead: DropLead
  leadPresence: LeadPresence // how often the lead appears (many tracks better with little/no lead)
  ohPat: string       // offbeat open-hat pattern ('' = none)
  bassGroove: string  // 16-step on/off mask for the bassline's rhythm
  fx: FxChar          // the track's shared echo/reverb space
  riser: boolean      // does this track use the through-line FM pulse riser texture?
  bg: BgKind          // the always-on subliminal BED texture that fills the track
  bgAccent: BgKind | null // an occasional distinctive ACCENT on top (null on most tracks)
}

const BASS: { sound: string; fm: number; rest: number }[] = [
  { sound: 'sawtooth', fm: 0, rest: 0.12 }, // classic acid
  { sound: 'sawtooth', fm: 0, rest: 0.32 }, // syncopated acid
  { sound: 'square', fm: 0, rest: 0.18 },   // hollow square
  { sound: 'square', fm: 0, rest: 0.38 },   // sparse square stabs
  { sound: 'supersaw', fm: 0, rest: 0.08 }, // thick reese
  { sound: 'supersaw', fm: 0, rest: 0.26 }, // reese with gaps
  { sound: 'sawtooth', fm: 3, rest: 0.1 },  // FM growl
  { sound: 'sawtooth', fm: 6, rest: 0.14 }, // heavy FM growl
  { sound: 'triangle', fm: 0, rest: 0.22 }, // round, soft
  { sound: 'triangle', fm: 2, rest: 0.16 }, // round FM
  { sound: 'pulse', fm: 0, rest: 0.16 },    // pulse / PWM-ish
  { sound: 'square', fm: 4, rest: 0.12 },   // FM square
]
// No triangle (flutey/naive) in the melodic voices — keep it dark: saw/square/supersaw.
const LEAD: { sound: string; unison: number }[] = [
  { sound: 'sawtooth', unison: 0 },
  { sound: 'sawtooth', unison: 3 },
  { sound: 'sawtooth', unison: 7 },
  { sound: 'square', unison: 0 },
  { sound: 'square', unison: 3 },
  { sound: 'supersaw', unison: 0 },
  { sound: 'supersaw', unison: 5 },
]
const STAB = ['sawtooth', 'square', 'supersaw', 'sawtooth', 'square', 'supersaw']
// Per-track KICK voice. The kick felt samey because every track used the one default `bd`
// sample. Each track now draws a distinct drum-machine kick (909/808/707/…) or a dirt `bd`
// variant via .n(), so the core kick TIMBRE changes track to track, not just its pattern.
export interface KickVoice { bank: string; n: number }
const KICK_VOICES: KickVoice[] = [
  { bank: 'RolandTR909', n: 0 }, // punchy, long
  { bank: 'RolandTR808', n: 0 }, // deep boom
  { bank: 'RolandTR707', n: 0 }, // tight, dry
  { bank: 'RolandTR606', n: 0 }, // short, raw
  { bank: 'RolandTR505', n: 0 }, // clicky
  { bank: 'AkaiLinn', n: 0 },    // round
  { bank: '', n: 0 },            // dirt bd (the original)
  { bank: '', n: 3 },            // dirt bd variant
  { bank: '', n: 5 },            // dirt bd variant
]

// Curated to musical four-on-floor / steady variants — no fussy 6-hit patterns.
const KICK = [
  'bd*4', 'bd*4', 'bd*4', 'bd*4',
  'bd ~ bd bd', 'bd*2 ~ bd ~', 'bd(3,8,2)', 'bd ~ ~ bd ~ ~ bd ~', 'bd(5,8)',
]
const CLAP = [
  '~ cp ~ cp', '~ cp', '~ ~ cp ~', 'cp ~ ~ cp ~ ~ cp ~', '~ cp ~ [cp cp]',
  '~ sd ~ sd', '~ ~ ~ cp', '~ sd ~ [sd cp]',
]
const HAT = [
  'hh*8', 'hh*16', 'hh*4', '[hh hh] hh hh hh', 'hh ~ hh ~ hh ~ hh hh',
  'hh*8 hh*16', 'hh*16 hh*8', '~ hh ~ hh', 'hh ~ [hh hh] hh', 'hh*12',
]
const PERC: PercKind[] = ['none', 'none', 'rim', 'shaker', 'noise', 'ride', 'tom']
const PAD: PadMode[] = ['stab', 'stab', 'off', 'drone', 'arp']
// Straight, no shuffle — swing reads as groovy/playful; dark techno stays rigid.
const SWING = [0]
const DROP_LEAD: DropLead[] = ['stab', 'stab', 'arp', 'lead']
// The leads are loved → let them OUT more: ~10% of tracks have no lead, ~20% only in peaks, ~70% full.
// (Picked with anti-repeat — not a per-track coin-flip — so it's consistent, not arbitrary.)
const LEAD_PRESENCE: LeadPresence[] = ['none', 'sparse', 'sparse', 'full', 'full', 'full', 'full', 'full', 'full', 'full']
const OH = ['~ oh ~ oh', '~ oh ~ oh', '', '~ ~ oh ~', 'oh ~ oh ~', '~ oh', '[~ oh]*2']
const BASS_GROOVE = [
  '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1', // driving 16ths
  '1 ~ 1 ~ 1 ~ 1 ~ 1 ~ 1 ~ 1 ~ 1 ~', // straight 8ths
  '~ 1 ~ 1 ~ 1 ~ 1 ~ 1 ~ 1 ~ 1 ~ 1', // offbeat (between kicks)
  '1 ~ ~ 1 1 ~ ~ 1 1 ~ ~ 1 1 ~ ~ 1', // electro / syncopated
  '1 1 ~ 1 1 1 ~ 1 1 1 ~ 1 1 1 ~ 1', // rolling
  '1 ~ ~ ~ 1 ~ ~ 1 ~ ~ 1 ~ 1 ~ ~ ~', // dub sparse
  '1 1 1 ~ 1 1 1 ~ 1 1 1 ~ 1 1 1 ~', // triplet-feel groups
]

// Track FX "spaces" — the character that ties every part's echo/reverb together.
const FX_SPACES: FxChar[] = [
  { delay: 0.12, delayTime: '0.1875', delayFb: 0.25, room: 0.16, roomSize: 3 }, // tight / dry club
  { delay: 0.22, delayTime: '0.375', delayFb: 0.34, room: 0.28, roomSize: 4 },  // club
  { delay: 0.3, delayTime: '0.375', delayFb: 0.4, room: 0.44, roomSize: 5 },    // spacious
  { delay: 0.45, delayTime: '0.5', delayFb: 0.52, room: 0.55, roomSize: 6 },    // dub (echo-led)
  { delay: 0.18, delayTime: '0.25', delayFb: 0.3, room: 0.68, roomSize: 8 },    // cavern (reverb-led)
]

function pick<T>(rng: Rng, arr: readonly T[], anti: AntiRepeatBuffer, cat: string): T {
  const opts = arr.map((_, i) => [String(i), 1] as Weighted<string>)
  const idx = Number(weightedPick(rng, anti.penalize(cat, opts)))
  anti.record(cat, String(idx))
  return arr[idx]
}

export function chooseStyle(rng: Rng, anti: AntiRepeatBuffer): TrackStyle {
  const b = pick(rng, BASS, anti, 'st_bass')
  const l = pick(rng, LEAD, anti, 'st_lead')
  return {
    bassSound: b.sound, bassFm: b.fm, bassRest: b.rest,
    leadSound: l.sound, leadUnison: l.unison,
    stabSound: pick(rng, STAB, anti, 'st_stab'),
    kickVoice: pick(rng, KICK_VOICES, anti, 'st_kickvoice'),
    kickPat: pick(rng, KICK, anti, 'st_kick'),
    clapPat: pick(rng, CLAP, anti, 'st_clap'),
    hatPat: pick(rng, HAT, anti, 'st_hat'),
    perc: pick(rng, PERC, anti, 'st_perc'),
    padMode: pick(rng, PAD, anti, 'st_pad'),
    swing: pick(rng, SWING, anti, 'st_swing'),
    dropLead: pick(rng, DROP_LEAD, anti, 'st_droplead'),
    leadPresence: pick(rng, LEAD_PRESENCE, anti, 'st_leadpres'),
    ohPat: pick(rng, OH, anti, 'st_oh'),
    bassGroove: pick(rng, BASS_GROOVE, anti, 'st_bgroove'),
    fx: pick(rng, FX_SPACES, anti, 'st_fx'),
    riser: pick(rng, [true, false, false], anti, 'st_riser'), // ~1/3 of tracks
    bg: pick(rng, BG_BEDS, anti, 'st_bg'),                    // always a subliminal bed
    bgAccent: rng.next() < ACCENT_CHANCE ? pick(rng, BG_ACCENTS, anti, 'st_bgacc') : null, // a rare distinctive accent
  }
}
