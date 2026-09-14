// Oracle for the Godot port's RadioTrackName: runs web src/radio/trackName.ts itself over a fixed set of inputs (every
// mood family, keys, tempos, seeds) and writes the names to the Godot project's tests/fixtures/radio_track_names.json.
//   node --experimental-strip-types --no-warnings scripts/export-radio-track-names.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../tests/fixtures/radio_track_names.json')
const CASES = 240
const SEED_SPACE = 0x1000000      // six hex digits, like the composer's session seeds
const SEED_STEP = 2654435761      // Knuth's multiplicative hash: well-spread seeds
const TRACKS_PER_SEED = 7

const MOODS = ['acid_dark', 'dub_techno', 'dark_techno', 'deep', 'ambient', 'hypnotic', 'industrial', 'hard_techno',
  'melodic', 'minimal', 'ACID', 'Chill']
const KEYS = ['C', 'C#', 'D', 'E', 'F#', 'G', 'A', 'Bb', 'B']
const BPMS = [95, 120, 124, 128, 133, 140, 133.5]

const { radioTrackName } = await import('../src/radio/trackName.ts')
const cases = []
for (let i = 0; i < CASES; i++) {
  const seed = ((i * SEED_STEP) % SEED_SPACE).toString(16).toUpperCase().padStart(6, '0')
  const input = { mood: MOODS[i % MOODS.length], bpm: BPMS[i % BPMS.length], key: KEYS[i % KEYS.length],
    trackSeed: `${seed}:t${i % TRACKS_PER_SEED}` }
  cases.push({ ...input, name: radioTrackName(input) })
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(cases, null, 2) + '\n')
console.log(`radio track names: ${cases.length} cases -> ${OUT}`)
