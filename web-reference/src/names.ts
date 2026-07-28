/**
 * Generator of names styled as factory model designations (RA9, T-2000, RTX4080).
 * Names are intentionally NOT localized — they are "hardware indexes", the same in every language.
 * Used for the default player name (first launch) and for the bot's name each time
 * it is added to the lobby.
 */

// "Techno"-sounding letter prefixes (1–3 uppercase letters).
const PREFIXES = [
  'RA', 'RT', 'RTX', 'GTX', 'MX', 'ZX', 'XJ', 'HK', 'AX', 'RX', 'VX', 'NX',
  'TK', 'DRX', 'KR', 'SR', 'TX', 'GX', 'JX', 'BX', 'CX', 'DX', 'PX', 'ZR',
  'QL', 'OR', 'KV', 'LR', 'MK', 'ARC', 'EX', 'OX', 'T', 'K', 'X', 'V', 'Z',
] as const

// Optional revision letter suffix (empty entries → suffix is more often absent).
const SUFFIXES = ['', '', '', '', '', 'X', 'S', 'A', 'R', 'Z'] as const

const MIN_DIGITS = 1
const MAX_DIGITS = 4
const DASH_CHANCE = 0.3       // fraction of names with a dash (T-2000), the rest joined (RTX4080)
const DECIMAL_BASE = 10

/** Generated name format: prefix, optional dash, 1–4 digits, optional revision letter. */
export const MODEL_NAME_RE = /^[A-Z]{1,3}-?\d{1,4}[A-Z]?$/

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** A number of `count` digits without a leading zero. */
function numericTail(count: number): string {
  let s = String(1 + Math.floor(Math.random() * (DECIMAL_BASE - 1)))   // first digit 1..9
  for (let i = 1; i < count; i++) s += Math.floor(Math.random() * DECIMAL_BASE)
  return s
}

/** Random name styled as a robot/hardware model: RA9, T-2000, RTX4080, AX12S. */
export function generateModelName(): string {
  const prefix = pick(PREFIXES)
  const tail = numericTail(randInt(MIN_DIGITS, MAX_DIGITS))
  const dashed = Math.random() < DASH_CHANCE
  // Suffix only on the joined form, to keep the name short and readable.
  const suffix = dashed ? '' : pick(SUFFIXES)
  return `${prefix}${dashed ? '-' : ''}${tail}${suffix}`
}
