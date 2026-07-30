class_name Overheat
## Streak-derived modifiers, bounty and cooldown-break rules. Ported from web overheat.ts.

const DOT_CAP := 10

## OVERHEAT movement/cooldown modifiers by streak: {speed, beam_cd, shield_cd, see_through}.
static func overheat_mods(streak: int) -> Dictionary:
	if streak >= Streak.STREAK_SINGULARITY:
		return {"speed": 1.3, "beam_cd": 1.5, "shield_cd": 1.5, "see_through": true}
	if streak >= Streak.STREAK_TRIPLE:
		return {"speed": 1.2, "beam_cd": 1.3, "shield_cd": 1.3, "see_through": false}
	if streak >= Streak.STREAK_DOUBLE:
		return {"speed": 1.1, "beam_cd": 1.15, "shield_cd": 1.15, "see_through": false}
	return {"speed": 1.0, "beam_cd": 1.0, "shield_cd": 1.0, "see_through": false}

## Frags per kill by the VICTIM's streak (before reset): TRIPLE->2, SINGULARITY->3, else 1.
static func bounty_frags(victim_streak: int) -> int:
	if victim_streak >= Streak.STREAK_SINGULARITY:
		return 3
	if victim_streak >= Streak.STREAK_TRIPLE:
		return 2
	return 1

## Breaking a TRIPLE+ streak resets the killer's cooldowns.
static func break_resets_cooldowns(victim_streak: int) -> bool:
	return victim_streak >= Streak.STREAK_TRIPLE

## Dots next to the name = streak, capped at DOT_CAP.
static func streak_dots(streak: int) -> int:
	return clampi(streak, 0, DOT_CAP)
