class_name MatchConst
## Match-rule constants — ported from web-reference/src/constants.ts (+ Match.ts END_FREEZE_MS).

const RESPAWN_GHOST_MS := 1500.0    # ghost (invulnerable) phase duration after a death
const READY_COUNTDOWN_MS := 3000.0  # countdown before the fight (used by the entry ritual, later)

const MS_PER_MIN := 60000.0
const MATCH_DURATIONS_MIN := [3, 5, 10]   # lobby choices (web MATCH_DURATIONS_MIN)
const DEFAULT_MATCH_DURATION_MIN := 5     # web DEFAULT_MATCH_DURATION_MIN
const DEFAULT_MATCH_DURATION_MS := DEFAULT_MATCH_DURATION_MIN * MS_PER_MIN
const END_FREEZE_MS := 200.0              # freeze-frame between the match end and the outcome screen
