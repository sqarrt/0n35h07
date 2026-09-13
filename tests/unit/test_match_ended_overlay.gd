extends GutTest
## Match-end overlay: outcome, players ranked by kills, reason and an exit; the pause menu stays shut after the end.

const TOP_ID := 0
const TOP_KILLS := 2
const RESULT := {
	"outcome": MatchResult.OUTCOME_WIN,
	"reason": MatchResult.REASON_TIME,
	"scores": [
		{"id": 1, "kills": 1, "deaths": 2, "team": 1},
		{"id": TOP_ID, "kills": TOP_KILLS, "deaths": 1, "team": 0},
	],
	"ranking": [],
}

func _overlay() -> MatchEndedOverlay:
	var o := MatchEndedOverlay.new()
	add_child_autofree(o)
	o.show_result(RESULT)
	return o

func test_shows_outcome_reason_and_exit() -> void:
	var o := _overlay()
	assert_true(o.visible)
	assert_eq((o.find_child("Outcome", true, false) as Label).text, "VICTORY")
	assert_eq((o.find_child("Reason", true, false) as Label).text, "TIME UP")
	assert_true(o.find_child("Exit", true, false) is Button, "an exit back to the menu")

func test_rows_list_players_by_kills() -> void:
	var o := _overlay()
	var ranking := o.find_child("Ranking", true, false)
	assert_eq((ranking.get_child(0) as Label).text, HudModel.player_name(TOP_ID), "row 1: name column")
	assert_eq((ranking.get_child(1) as Label).text, str(TOP_KILLS), "row 1: kills column")

func test_pause_menu_can_be_disabled() -> void:
	var p := PauseOverlay.new()
	add_child_autofree(p)
	p.enabled = false
	var ev := InputEventAction.new()
	ev.action = "pause"
	ev.pressed = true
	p._unhandled_input(ev)
	assert_false(p.visible, "Esc does nothing once the match has ended")
