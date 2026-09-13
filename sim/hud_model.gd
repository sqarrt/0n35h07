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

const READY := 1.0
const RING_CHARGING := Color("#006666")        # web Crosshair stroke #066
const RING_READY := Color("#00ffff")           # web #0ff
const BRACKET_ARM := 78.0                      # web ShieldBrackets A: arm length, px
const SHIELD_ACTIVE := Color("#66aaff")        # web #6af while the shield is up
const SHIELD_READY := Color("#4169e1")
const SHIELD_CHARGING := Color("#1a2a6e")
const SHIELD_ACTIVE_OPACITY := 1.0
const SHIELD_READY_OPACITY := 0.85
const SHIELD_CHARGING_OPACITY := 0.5
const DASH_READY := Color("#2e9d57")           # web DashIndicator
const DASH_CHARGING := Color("#0c4d28")
const DASH_READY_OPACITY := 1.0
const DASH_CHARGING_OPACITY := 0.55

## Beam cooldown ring colour (web Crosshair).
static func crosshair_ring_color(progress: float) -> Color:
	return RING_READY if progress >= READY else RING_CHARGING

## Shield corner bracket look (web ShieldBrackets): colour, group opacity and the arm length grown from the vertex.
static func shield_bracket_look(progress: float, active: bool) -> Dictionary:
	var p := clampf(progress, 0.0, READY)
	var length := BRACKET_ARM * p
	if active:
		return {"color": SHIELD_ACTIVE, "opacity": SHIELD_ACTIVE_OPACITY, "length": length}
	if p >= READY:
		return {"color": SHIELD_READY, "opacity": SHIELD_READY_OPACITY, "length": length}
	return {"color": SHIELD_CHARGING, "opacity": SHIELD_CHARGING_OPACITY, "length": length}

## Dash side bar look (web DashIndicator): colour, opacity and the fill share grown from the centre.
static func dash_bar_look(progress: float) -> Dictionary:
	var p := clampf(progress, 0.0, READY)
	if p >= READY:
		return {"color": DASH_READY, "opacity": DASH_READY_OPACITY, "fill": p}
	return {"color": DASH_CHARGING, "opacity": DASH_CHARGING_OPACITY, "fill": p}

static func player_name(id: int) -> String:
	return "YOU" if id == 0 else "BOT"
