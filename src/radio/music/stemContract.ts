import type { Role } from './types'

// The director owns global tempo, scale and orbit routing. A stem is one role's
// part — it may stack several lines/instruments — authored relative to those.
// These constants + the validator enforce the "combinability" contract: only
// tempo/scale/orbit are off-limits; stacking voices inside a stem is fine.

/** Roles selected exactly once per composition, in render order. */
export const CORE_ROLES = ['kicks', 'bass', 'lead'] as const
export type CoreRole = (typeof CORE_ROLES)[number]

/** Per-role audio orbit (effects bus). Assigned by the director, never by stems. */
export const ROLE_ORBIT: Record<Role, number> = {
  kicks: 2,
  bass: 3,
  lead: 4,
  sfx: 5,
}

/** Fixed tempo (musical BPM). Emitted as setcpm(FIXED_BPM / BEATS_PER_CYCLE). */
export const FIXED_BPM = 120
export const BEATS_PER_CYCLE = 4

/** WAV loop length in cycles. 1 cycle = 2 s at setcpm(120/4); 4 cycles = 8 s. */
export const RENDER_CYCLES = 4

/** Fixed key. Emitted via setScale so stems' .sc() resolves against it. */
export const FIXED_SCALE = 'c:minor'

/** Max SFX stems layered on top of the core trio (0..N, drawn after the core). */
export const DEFAULT_MAX_SFX = 2

// A stem must NOT pin tempo, scale or orbit — that would break swapability.
const FORBIDDEN_PATTERNS: readonly { re: RegExp; why: string }[] = [
  { re: /\bsetcpm\b/, why: 'setcpm (tempo is owned by the director)' },
  { re: /\bsetcps\b/, why: 'setcps (tempo is owned by the director)' },
  { re: /\bsetScale\b/, why: 'setScale (key is owned by the director)' },
  { re: /\.orbit\s*\(/, why: '.orbit() (orbit is owned by the director)' },
  { re: /\.o\s*\(/, why: '.o() (orbit is owned by the director)' },
]

/** Returns a list of contract violations ([] means the stem is valid). */
export function validateStemCode(code: string): string[] {
  return FORBIDDEN_PATTERNS.filter(({ re }) => re.test(code)).map(({ why }) => `must not use ${why}`)
}
