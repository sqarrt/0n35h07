import type { TrackDescriptor } from './trackDescriptor'

// Human-but-machine track names. Fully deterministic from the track seed — the same {seed,index} always yields the
// same name. A small seeded RNG picks the word FAMILY (by mood → matches the track's character), the SCHEME (9
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
  dark: ['Iron', 'Ashen', 'Null', 'Cold', 'Black', 'Static', 'Concrete', 'Leaden', 'Grim', 'Severed', 'Rust', 'Hollow',
    'Brutal', 'Charred', 'Frozen', 'Buried', 'Shattered', 'Molten', 'Tarnished', 'Obsidian', 'Fractured', 'Sunless',
    'Bleak', 'Vile', 'Forsaken', 'Wretched', 'Withered', 'Gaunt', 'Sullen', 'Bitter', 'Carrion', 'Dread', 'Ferric',
    'Slate', 'Granite', 'Murderous', 'Funeral', 'Sepulchral', 'Onyx', 'Sable', 'Dire', 'Stark', 'Scorched', 'Choked',
    'Riven', 'Ravaged', 'Hardened', 'Profane', 'Unhallowed', 'Ironclad',
    'Cindered', 'Ironbound', 'Desolate', 'Wracked', 'Smouldering', 'Calcified', 'Mournful', 'Sundered', 'Blighted',
    'Abyssal', 'Vengeful', 'Merciless', 'Ashfallen', 'Coldforged', 'Lightless', 'Necrotic', 'Tyrant', 'Godless'],
  dub: ['Sunken', 'Grey', 'Distant', 'Dim', 'Damp', 'Murky', 'Deep', 'Drowned', 'Faded', 'Quiet',
    'Hazy', 'Hushed', 'Brackish', 'Stagnant', 'Frigid', 'Glacial', 'Submerged', 'Bottomless', 'Vacant', 'Pallid',
    'Wan', 'Listless', 'Muted', 'Veiled', 'Shrouded', 'Nebulous', 'Drifting', 'Vacuous', 'Tenebrous', 'Liminal',
    'Subaqueous', 'Fathomless', 'Becalmed', 'Forlorn', 'Sodden', 'Overcast',
    'Tidal', 'Phantom', 'Echoing', 'Sleepless', 'Cavernous', 'Underlit', 'Saltworn', 'Driftless', 'Lowlit',
    'Tempered', 'Moonless', 'Tideless', 'Sightless', 'Becalming', 'Slumbering', 'Wraithlike'],
  acid: ['Caustic', 'Toxic', 'Bright', 'Corrosive', 'Acrid', 'Volatile', 'Neon', 'Raw',
    'Acidic', 'Searing', 'Blistering', 'Septic', 'Virulent', 'Noxious', 'Fuming', 'Lurid', 'Garish', 'Electric',
    'Livid', 'Feral', 'Rabid', 'Seething', 'Writhing', 'Mutant', 'Radiant', 'Bilious', 'Putrid', 'Rancid',
    'Twitching', 'Glowing', 'Effervescent', 'Unstable', 'Reactive', 'Corroded',
    'Sizzling', 'Vitriolic', 'Scalding', 'Festering', 'Galvanic', 'Plasmic', 'Corroding', 'Bubbling', 'Irradiated',
    'Mutagenic', 'Phosphoric', 'Hyperactive', 'Synthetic', 'Blinding', 'Venomous', 'Fissile'],
  default: ['Grey', 'Hollow', 'Distant', 'Cold', 'Static', 'Faint', 'Pale',
    'Blank', 'Vacant', 'Null', 'Drifting', 'Muted', 'Idle', 'Latent', 'Dormant', 'Spare', 'Flat', 'Dull', 'Stray',
    'Lone', 'Vague', 'Inert', 'Neutral', 'Sparse',
    'Spent', 'Adrift', 'Minor', 'Lapsed', 'Tepid', 'Plain', 'Slack', 'Numb', 'Stale', 'Drab'],
}
const NOUN: Record<Family, string[]> = {
  dark: ['Verdict', 'Reactor', 'Anvil', 'Spire', 'Cathedral', 'Pyre', 'Sector', 'Engine', 'Vault', 'Wraith', 'Mass',
    'Saint', 'Forge', 'Cell', 'Furnace', 'Crucible', 'Monolith', 'Obelisk', 'Gallows', 'Sepulchre', 'Ossuary',
    'Reliquary', 'Bastion', 'Citadel', 'Bunker', 'Conduit', 'Turbine', 'Piston', 'Girder', 'Chassis', 'Husk', 'Relic',
    'Idol', 'Effigy', 'Shroud', 'Tomb', 'Crypt', 'Catacomb', 'Altar', 'Dirge', 'Knell', 'Requiem', 'Sermon', 'Doctrine',
    'Decree', 'Tribunal', 'Gauntlet', 'Maw', 'Scourge', 'Edifice',
    'Mandate', 'Sanctum', 'Ordeal', 'Reckoning', 'Cortege', 'Sarcophagus', 'Inquisition', 'Slaughterhouse', 'Hangman',
    'Mausoleum', 'Charnel', 'Gibbet', 'Pulpit', 'Cenotaph', 'Reckoner', 'Warden', 'Dominion', 'Threshold'],
  dub: ['Hollow', 'Fathom', 'Chamber', 'Murk', 'Abyss', 'Cinder', 'Mist', 'Drift', 'Tide', 'Cavern',
    'Trench', 'Gulf', 'Void', 'Expanse', 'Depths', 'Shoal', 'Undertow', 'Maelstrom', 'Vortex', 'Eddy', 'Lull', 'Hush',
    'Penumbra', 'Gloom', 'Haze', 'Vapor', 'Sediment', 'Silt', 'Brine', 'Current', 'Wake', 'Threshold', 'Limbo',
    'Strata', 'Hollows', 'Quagmire', 'Estuary',
    'Fjord', 'Basin', 'Lagoon', 'Sluice', 'Backwater', 'Drainage', 'Spillway', 'Cistern', 'Aquifer', 'Floe',
    'Reservoir', 'Murmur', 'Subsidence', 'Hollowness', 'Seabed', 'Nightfall'],
  acid: ['Bloom', 'Coil', 'Serum', 'Worm', 'Vat', 'Loop', 'Spore', 'Reagent', 'Toxin',
    'Solvent', 'Enzyme', 'Culture', 'Strain', 'Mutation', 'Membrane', 'Synapse', 'Tendril', 'Larva', 'Hive', 'Swarm',
    'Catalyst', 'Compound', 'Residue', 'Effluent', 'Sludge', 'Ichor', 'Venom', 'Bile', 'Pustule', 'Filament', 'Reactor',
    'Petri', 'Beaker', 'Isotope', 'Slime',
    'Reactant', 'Polymer', 'Plasmid', 'Pathogen', 'Toxoid', 'Distillate', 'Precipitate', 'Catalyzer', 'Genome',
    'Spawnpool', 'Outbreak', 'Contagion', 'Vector', 'Petridish', 'Nutrient', 'Bioreactor'],
  default: ['Signal', 'Drift', 'Channel', 'Loop', 'Phase', 'Vector', 'Echo', 'Frame',
    'Pulse', 'Node', 'Array', 'Cipher', 'Relay', 'Circuit', 'Lattice', 'Matrix', 'Conduit', 'Beacon', 'Fragment',
    'Sequence', 'Pattern', 'Cycle', 'Glitch', 'Vapor', 'Strobe', 'Filter',
    'Routine', 'Kernel', 'Buffer', 'Register', 'Token', 'Packet', 'Stream', 'Index', 'Schema', 'Daemon'],
}
const MODEL = ['9X', 'RT', 'S7', 'MK2', 'AX2', 'D3', 'XS', 'V2', 'HX', 'RS', 'TR', 'CV', 'FX', 'Z9', 'Q4', 'NX', 'EX', 'K7', 'P1', 'GX']
// Letter/number suffixes — cheap entropy that multiplies the name space without needing more vocabulary.
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Sigma', 'Omega', 'Kappa', 'Lambda', 'Zeta', 'Phi', 'Psi', 'Chi', 'Tau', 'Rho', 'Xi', 'Eta', 'Mu', 'Nu', 'Pi']
const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XIII', 'XV', 'XVII', 'XIX', 'XX', 'XXX', 'XL']

function pick<T>(arr: T[], r: number): T { return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))] }
function hex2(r: number): string { return Math.floor(r * 256).toString(16).padStart(2, '0') }

/** A human-but-machine name for the track. The scheme + words are chosen deterministically from the track seed. */
export function radioTrackName(t: NameInput): string {
  const rng = makeRng(t.trackSeed)
  const fam = familyOf(t.mood)
  const adj = pick(ADJ[fam], rng())
  const noun = pick(NOUN[fam], rng())
  const scheme = Math.floor(rng() * 9)
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
    case 3: {   // model index (like the player nicknames)
      const code = rng() < 0.5 ? pick(MODEL, rng()) : `-${10 + Math.floor(rng() * 90)}`
      return code.startsWith('-') ? `${noun}${code}` : `${noun} ${code}`
    }
    case 4:     // word(s) + a greek-letter designation
      return pick([`${adj} ${noun} ${pick(GREEK, rng())}`, `${noun} ${pick(GREEK, rng())}`, `${pick(GREEK, rng())} ${noun}`], rng())
    case 5:     // word(s) + a roman numeral (a "movement"/"mark" feel)
      return pick([`${adj} ${noun} ${pick(ROMAN, rng())}`, `${noun} — ${pick(ROMAN, rng())}`, `${adj} ${noun} mk.${pick(ROMAN, rng())}`], rng())
    case 6:     // definite-article title — a heavier, named feel ("The Iron Verdict")
      return pick([`The ${adj} ${noun}`, `The ${noun}`, `The ${noun} of ${adj}`], rng())
    case 7: {   // noun-noun compound (second noun, same family) — "Furnace Crypt", "Reactor//Husk"
      const noun2 = pick(NOUN[fam], rng())
      return pick([`${noun} ${noun2}`, `${noun}//${noun2}`, `${noun}-${noun2}`], rng())
    }
    default: {  // catalogue index — "Cold Vault No.7", "Vault RT·12"
      const n = 1 + Math.floor(rng() * 99)
      return pick([`${adj} ${noun} No.${n}`, `${noun} ${pick(MODEL, rng())}·${n}`, `${noun} no.${n}`], rng())
    }
  }
}

/** A descriptor's per-track seed (the deterministic RNG seed): `${seed}:t${index}`. */
export function trackSeedOf(d: TrackDescriptor): string {
  return `${d.seed}:t${d.index}`
}
