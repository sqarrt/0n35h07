class_name BotConst
## Bot AI constants — ported from web-reference/src/constants.ts (BOT_*).

const BOT_MOVE_SPEED := 2.5
const BOT_SHIELD_INTERVAL_MS := 5000.0   # how often the AI decides to raise the shield
const BOT_CHASE_DIST := 8.0              # CHASE <-> STRAFE switch distance
const BOT_RETREAT_MS := 500.0            # retreat after its own shot
const BOT_DODGE_THRESH := 0.25           # opponent windupProgress -> initiate DODGE
const BOT_EVADE_NEAR := 6.0              # point-blank distance for the EVADE bunny-hop
const BOT_EVADE_DASH_RATE := 1.5         # base dash rate per second in EVADE (x evadeSkill)
const BOT_BAIT_LATE_PROGRESS := 0.55     # windupProgress from which a charge counts as "late" to bait
const BOT_BAIT_COOLDOWN_MS := 4000.0     # ms between shield baits (anti-loop)

const ARENA_HALF := 25.0                 # placeholder wander bounds (real map spawns arrive in #5)

static func random_arena_pos() -> Vector3:
	return Vector3(randf_range(-ARENA_HALF, ARENA_HALF), MoveConst.EYE_HEIGHT, randf_range(-ARENA_HALF, ARENA_HALF))
