// Oracle for the Godot port's RadioEntitlement: runs web src/radio/entitlement.ts itself over trials, days and ownership
// (new day, same day, a clock wound back, the caps and past them) and writes the answers to the Godot project's
// tests/fixtures/radio_entitlement.json. Infinity is written as the string "Infinity" (JSON has no infinity).
//   node --experimental-strip-types --no-warnings scripts/export-radio-entitlement.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../tests/fixtures/radio_entitlement.json')
const NOON = 'T12:00:00'   // a local midday: the day key never straddles midnight

const DAYS = ['2025-12-31', '2026-01-01', '2026-06-27', '2026-06-28', '2026-06-29', '2027-01-01']
const TRIALS = [
  undefined,
  { day: '2026-06-27', gens: 9, saves: 4 },
  { day: '2026-06-28', gens: 3, saves: 1 },
  { day: '2026-06-28', gens: 10, saves: 5 },
  { day: '2026-06-28', gens: 12, saves: 7 },
  { day: '2026-06-29', gens: 0, saves: 0 },
  { day: '2025-12-31', gens: 10, saves: 5 },
]

const e = await import('../src/radio/entitlement.ts')
const at = (day) => new Date(day + NOON)
const finite = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === Infinity ? 'Infinity' : v]))

const roll = [], consume = [], entitlement = [], today = []
for (const day of DAYS) {
  today.push({ day, key: e.todayKey(at(day)), empty: e.emptyTrial(at(day)) })
  for (const trial of TRIALS) {
    roll.push({ trial: trial ?? null, today: day, out: e.rollTrial(trial, at(day)) })
    if (trial) {
      consume.push({ kind: 'gen', trial, today: day, out: e.consumeGen(trial, at(day)) })
      consume.push({ kind: 'save', trial, today: day, out: e.consumeSave(trial, at(day)) })
    }
  }
}
for (const owned of [false, true]) {
  for (const devUnlimited of [false, true]) {
    for (const trial of TRIALS.filter(Boolean)) {
      entitlement.push({ owned, devUnlimited, trial, out: finite(e.entitlementFor({ owned, devUnlimited, trial })) })
    }
  }
}
const fixture = { freeGensPerDay: e.FREE_GENS_PER_DAY, freeSavesPerDay: e.FREE_SAVES_PER_DAY, today, roll, consume, entitlement }
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n')
console.log(`radio entitlement: ${roll.length} rolls, ${consume.length} consumes, ${entitlement.length} entitlements -> ${OUT}`)
