// Core data model for the stem library and a composed track. Pure data — no
// Strudel, no React — so it is shared by the director and the unit tests.

export const ROLES = ['kicks', 'bass', 'lead', 'sfx'] as const
export type Role = (typeof ROLES)[number]

/** A stem (one role's part; may stack several lines) authored under the contract. */
export interface Stem {
  readonly role: Role
  /** Stable id, role-relative: e.g. "bass/acid_walk_03". */
  readonly id: string
  /** File name without extension. */
  readonly name: string
  /** The Strudel expression for this role's part (scale/tempo/orbit-relative; may stack). */
  readonly code: string
}

export type StemLibrary = Readonly<Record<Role, readonly Stem[]>>

export interface CompositionLayer {
  readonly role: Role
  readonly stemId: string
  readonly orbit: number
}

/** The director's deterministic output for a given seed + library. */
export interface Composition {
  readonly seed: string
  readonly bpm: number
  readonly scale: string
  /** Full Strudel program: setcpm + setScale + stack(...). */
  readonly code: string
  readonly layers: readonly CompositionLayer[]
}

export function emptyLibrary(): StemLibrary {
  return { kicks: [], bass: [], lead: [], sfx: [] }
}
