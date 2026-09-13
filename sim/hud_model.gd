class_name HudModel
## Pure HUD text helpers (testable, no nodes).

## Streak banner text for a frag by the local player; "" when nothing should show.
static func banner_for(shooter_is_human: bool, streak: int, first_blood: bool) -> String:
	if not shooter_is_human:
		return ""
	return Streak.tier_word(Streak.announce_kind(streak, first_blood))

const SECONDS_PER_MIN := 60
const NO_TIME := "--:--"

## Match timer text "MM:SS" (web MatchHud fmt): null -> "--:--", negative seconds clamp to 00:00.
static func match_time(seconds) -> String:
	if seconds == null:
		return NO_TIME
	var s := maxi(0, int(seconds))
	@warning_ignore("integer_division")
	var minutes := s / SECONDS_PER_MIN
	return "%02d:%02d" % [minutes, s % SECONDS_PER_MIN]

const OUTCOME_LABELS := {
	MatchResult.OUTCOME_WIN: "VICTORY",
	MatchResult.OUTCOME_LOSE: "DEFEAT",
	MatchResult.OUTCOME_DRAW: "DRAW",
}
const REASON_LABELS := {MatchResult.REASON_TIME: "TIME UP"}

## Match-end headline (web dictionary matchOutcome*; English until i18n lands).
static func outcome_label(outcome: String) -> String:
	return OUTCOME_LABELS.get(outcome, "")

## Why the match ended (web dictionary matchReason*).
static func reason_label(reason: String) -> String:
	return REASON_LABELS.get(reason, "")

## Result rows as the web overlay lists them: kills descending, equal kills by id.
static func ranked_scores(scores: Array) -> Array:
	var rows := scores.duplicate()
	rows.sort_custom(func(a, b): return a["kills"] > b["kills"] or (a["kills"] == b["kills"] and a["id"] < b["id"]))
	return rows

static func score_line(you: int, them: int) -> String:
	return "YOU %d   —   BOT %d" % [you, them]

static func player_name(id: int) -> String:
	return "YOU" if id == 0 else "BOT"

## Kill-feed line: "SHOOTER  >  VICTIM".
static func frag_line(shooter_id: int, victim_id: int) -> String:
	return "%s  ▸  %s" % [player_name(shooter_id), player_name(victim_id)]
