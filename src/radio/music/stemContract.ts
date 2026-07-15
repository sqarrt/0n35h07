// Tempo is owned by the director; a stem is one role's part, authored relative to it.
// Only these two constants survived the move to the current composer — the rest of the old
// "combinability contract" (role list, orbit routing, render length, fixed scale, and the
// stem-code validator) had no callers left and was removed.

/** Fixed tempo (musical BPM). Emitted as setcpm(FIXED_BPM / BEATS_PER_CYCLE). */
export const FIXED_BPM = 120
export const BEATS_PER_CYCLE = 4
