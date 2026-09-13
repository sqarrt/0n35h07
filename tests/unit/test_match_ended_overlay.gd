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
	var roster := Roster.new()
	roster.add({"id": TOP_ID, "name": "RA-1", "color": "#4af"})
	roster.add({"id": 1, "name": "EX82R", "color": "#fd4"})
	o.show_result(RESULT, roster, {TOP_ID: "double", 1: ""})
	return o

func test_shows_outcome_reason_and_exit() -> void:
	var o := _overlay()
	assert_true(o.visible)
	var outcome := o.find_child("Outcome", true, false) as GlowText
	assert_eq(outcome.label().text, "VICTORY")
	assert_eq(outcome.layer_count(), 1, "web text-shadow 0 0 26px <outcome colour>")
	assert_almost_eq((outcome.layers()[0].material as ShaderMaterial).get_shader_parameter("sigma"), 13.0, 0.001)
	assert_eq((o.find_child("Reason", true, false) as Label).text, "TIME UP")
	assert_true(o.find_child("Exit", true, false) is Button, "an exit back to the menu")

func test_rows_list_players_by_kills() -> void:
	var o := _overlay()
	var ranking := o.find_child("Ranking", true, false)
	var top_name := ranking.get_child(0) as EffectText
	assert_eq(top_name.base_text(), "RA-1", "row 1: name column from the roster")
	assert_eq(top_name.kind(), "double", "the HUD streak effect stays on the name")
	var top_kills := ranking.get_child(1) as Label
	assert_eq(top_kills.text, str(TOP_KILLS), "row 1: kills column")
	assert_eq(top_kills.get_theme_color("font_color"), Color("#4af"), "kills in the player colour")

func test_pause_menu_can_be_disabled() -> void:
	var p := PauseOverlay.new()
	add_child_autofree(p)
	p.enabled = false
	var ev := InputEventAction.new()
	ev.action = "pause"
	ev.pressed = true
	p._unhandled_input(ev)
	assert_false(p.visible, "Esc does nothing once the match has ended")
