class_name HudModel
## Pure HUD text helpers (testable, no nodes).

## Streak banner text for a frag by the local player; "" when nothing should show.
static func banner_for(shooter_is_human: bool, streak: int, first_blood: bool) -> String:
	if not shooter_is_human:
		return ""
	return Streak.tier_word(Streak.announce_kind(streak, first_blood))

static func score_line(you: int, them: int) -> String:
	return "YOU %d   —   BOT %d" % [you, them]
