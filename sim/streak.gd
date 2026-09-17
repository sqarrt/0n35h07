class_name Streak
## Killstreak tiers + announce words. Ported from web streak.ts + streakConfig.ts.

const STREAK_DOUBLE := 2
const STREAK_TRIPLE := 3
const STREAK_SINGULARITY := 5

## Persistent nickname-highlight tier; "" for 0-1.
static func streak_tier(streak: int) -> String:
	if streak >= STREAK_SINGULARITY:
		return "singularity"
	if streak >= STREAK_TRIPLE:
		return "triple"
	if streak >= STREAK_DOUBLE:
		return "double"
	return ""

## Banner kind for a frag: first blood OR an exact tier threshold. "" for none.
static func announce_kind(streak: int, first_blood: bool) -> String:
	if first_blood:
		return "catalyst"
	if streak == STREAK_SINGULARITY:
		return "singularity"
	if streak == STREAK_TRIPLE:
		return "triple"
	if streak == STREAK_DOUBLE:
		return "double"
	return ""

static func tier_word(kind: String) -> String:
	match kind:
		"catalyst": return "CATALYST"
		"double": return "DOUBLE KILL"
		"triple": return "TRIPLE KILL"
		"singularity": return "SINGULARITY"
	return ""
