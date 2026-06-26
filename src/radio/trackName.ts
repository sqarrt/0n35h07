import type { TrackDescriptor } from './trackDescriptor'

// Human-but-machine track names. Fully deterministic from the track seed — the same {seed,index} always yields the
// same name. A small seeded RNG picks the word FAMILY (by mood → matches the track's character), the SCHEME (4
// distinct styles, so names are varied) and the words. Track names are intentionally NOT localized.

interface NameInput { mood: string; bpm: number; key: string; trackSeed: string }

// mulberry32 seeded from a string (xmur3-style hash) — local, deterministic, no deps.
function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Family = 'dark' | 'dub' | 'acid' | 'default'
function familyOf(mood: string): Family {
  // Most-specific first, so compound ids land sensibly (acid_dark → acid, dub_techno → dub, dark_techno → dark).
  const m = mood.toLowerCase()
  if (m.includes('acid')) return 'acid'
  if (m.includes('dub') || m.includes('deep') || m.includes('ambient') || m.includes('hypnotic')) return 'dub'
  if (m.includes('dark') || m.includes('techno') || m.includes('hard') || m.includes('industrial')) return 'dark'
  return 'default'
}

const ADJ: Record<Family, string[]> = {
  dark:    ['Iron', 'Ashen', 'Null', 'Cold', 'Black', 'Static', 'Concrete', 'Leaden', 'Grim', 'Severed', 'Rust', 'Hollow'],
  dub:     ['Sunken', 'Grey', 'Distant', 'Dim', 'Damp', 'Murky', 'Deep', 'Drowned', 'Faded', 'Quiet'],
  acid:    ['Caustic', 'Toxic', 'Bright', 'Corrosive', 'Acrid', 'Volatile', 'Neon', 'Raw'],
  default: ['Grey', 'Hollow', 'Distant', 'Cold', 'Static', 'Faint', 'Pale'],
}
const NOUN: Record<Family, string[]> = {
  dark:    ['Verdict', 'Reactor', 'Anvil', 'Spire', 'Cathedral', 'Pyre', 'Sector', 'Engine', 'Vault', 'Wraith', 'Mass', 'Saint', 'Forge', 'Cell'],
  dub:     ['Hollow', 'Fathom', 'Chamber', 'Murk', 'Abyss', 'Cinder', 'Mist', 'Drift', 'Tide', 'Cavern'],
  acid:    ['Bloom', 'Coil', 'Serum', 'Worm', 'Vat', 'Loop', 'Spore', 'Reagent', 'Toxin'],
  default: ['Signal', 'Drift', 'Channel', 'Loop', 'Phase', 'Vector', 'Echo', 'Frame'],
}
const MODEL = ['9X', 'RT', 'S7', 'MK2', 'AX2', 'D3', 'XS', 'V2', 'HX', 'RS']

function pick<T>(arr: T[], r: number): T { return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))] }
function hex2(r: number): string { return Math.floor(r * 256).toString(16).padStart(2, '0') }

/** A human-but-machine name for the track. The scheme + words are chosen deterministically from the track seed. */
export function radioTrackName(t: NameInput): string {
  const rng = makeRng(t.trackSeed)
  const fam = familyOf(t.mood)
  const adj = pick(ADJ[fam], rng())
  const noun = pick(NOUN[fam], rng())
  const scheme = Math.floor(rng() * 4)
  switch (scheme) {
    case 0: {   // hybrid: word(s) + a short machine tag
      const tag = pick([`// ${t.key}`, `· ${t.bpm}`, `-${hex2(rng())}`, `[${t.key}]`, `/${t.bpm}`], rng())
      return `${adj} ${noun} ${tag}`
    }
    case 1:     // two-word machine poetry
      return `${adj} ${noun}`
    case 2: {   // protocol / process
      const upper = noun.toUpperCase()
      const lower = noun.toLowerCase()
      return pick([`PROTOCOL: ${upper}`, `proc/${lower}`, `SYS.${upper}`, `daemon:${lower}`], rng())
    }
    default: {  // model index (like the player nicknames)
      const code = rng() < 0.5 ? pick(MODEL, rng()) : `-${10 + Math.floor(rng() * 90)}`
      return code.startsWith('-') ? `${noun}${code}` : `${noun} ${code}`
    }
  }
}

/** A descriptor's per-track seed (the deterministic RNG seed): `${seed}:t${index}`. */
export function trackSeedOf(d: TrackDescriptor): string {
  return `${d.seed}:t${d.index}`
}
