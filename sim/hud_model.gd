class_name HudModel
## Pure HUD text helpers (testable, no nodes).

## Streak banner word for a frag by ANY player (web announceStreak announces every shooter); "" when nothing shows.
static func announce_word(streak: int, first_blood: bool) -> String:
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

const BANNER_DURATION_S := 2.05                # web ks-annShow
# web ks-annShow keyframes as [fraction, opacity]; steps(1, end) holds each value until the next keyframe.
const BANNER_KEYFRAMES := [[0.0, 0.0], [0.02, 0.25], [0.03, 1.0], [0.04, 0.4], [0.05, 1.0], [0.90, 1.0], [0.98, 0.5], [1.0, 0.0]]
const POP_START_SCALE := 1.6                   # web cdPop
const POP_END_SCALE := 1.0
const POP_VISIBLE_AT := 0.25                   # cdPop opacity keyframe: fully visible at 25%
const POP_END_OPACITY := 0.9
const GHOST_BAR_MAX_SHARE := 0.5               # web RespawnOverlay: full bar = half the screen width

## Streak banner opacity `elapsed_s` after it appeared (web ks-annShow, stepped, no interpolation).
static func banner_opacity(elapsed_s: float) -> float:
	var t := elapsed_s / BANNER_DURATION_S
	var value: float = BANNER_KEYFRAMES[0][1]
	for key in BANNER_KEYFRAMES:
		if t >= key[0]:
			value = key[1]
	return value

## CSS `ease-out` timing (cubic-bezier(0, 0, 0.58, 1)).
static func css_ease_out(x: float) -> float:
	return CssTiming.cubic_bezier(x, CssTiming.EASE_OUT)

## Countdown number pop `progress` (0..1) through its 1 s animation (web cdPop, ease-out per keyframe segment).
static func countdown_pop(progress: float) -> Dictionary:
	var p := clampf(progress, 0.0, READY)
	var scale := POP_START_SCALE + (POP_END_SCALE - POP_START_SCALE) * css_ease_out(p)
	var opacity: float
	if p <= POP_VISIBLE_AT:
		opacity = css_ease_out(p / POP_VISIBLE_AT)
	else:
		opacity = READY + (POP_END_OPACITY - READY) * css_ease_out((p - POP_VISIBLE_AT) / (READY - POP_VISIBLE_AT))
	return {"scale": scale, "opacity": opacity}

## Ghost-phase bar width as a share of the screen width (web: progress × 50%).
static func ghost_bar_width_share(progress: float) -> float:
	return clampf(progress, 0.0, READY) * GHOST_BAR_MAX_SHARE

## Windup vignette opacity follows the charge (web WindupOverlay).
static func windup_vignette_opacity(progress: float) -> float:
	return clampf(progress, 0.0, READY)

## Streak banner text (web StreakBanner: `${name}: ${tierWord}`).
static func banner_text(player: String, tier_word: String) -> String:
	return "%s: %s" % [player, tier_word]

const BEAM_FLASH_MS := 200.0                                    # web useFlash(200): own shot
const PLAYER_HIT_FLASH_MS := 350.0                              # web useFlash(350): the local player was hit
const SHIELD_BLOCK_FLASH_MS := 250.0                            # web useFlash(250): the local player blocked
const BEAM_TINT := Color(0.0, 1.0, 1.0, 0.04)                   # web rgba(0,255,255,0.04)
const PLAYER_HIT_TINT := Color(1.0, 0.0, 0.0, 0.08)             # web rgba(255,0,0,0.08)
const SHIELD_BLOCK_TINT := Color(0.0, 180.0 / 255.0, 1.0, 0.07) # web rgba(0,180,255,0.07)

static func player_name(id: int) -> String:
	return "YOU" if id == 0 else "BOT"
