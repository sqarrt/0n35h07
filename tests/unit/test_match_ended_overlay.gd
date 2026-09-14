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
	var exit := o.find_child("Exit", true, false) as UiButton
	assert_not_null(exit, "an exit back to the menu")
	assert_eq(exit.variant, UiButton.PRIMARY, "web Button variant=\"primary\"")

func test_column_follows_the_web_flex_column() -> void:
	var o := _overlay()
	var column := o.find_child("Column", true, false) as CssColumn
	assert_not_null(column)
	assert_almost_eq(column.gap, MatchEndedOverlay.COLUMN_GAP, 0.001)
	assert_almost_eq(column.margins_of(o.find_child("Exit", true, false)), Vector2(UiButton.MARGIN_Y, UiButton.MARGIN_Y),
		Vector2(0.001, 0.001), "the button's own 0.4rem margins")

func test_boxes_follow_chrome_text_metrics() -> void:
	var o := _overlay()
	await wait_process_frames(2)
	var outcome := o.find_child("Outcome", true, false) as GlowText
	assert_gt((outcome.label().get_theme_font("font") as FontVariation).variation_embolden, 0.0, "web h1: bold")
	assert_almost_eq(outcome.size.y, 59.0, 0.01, "52 px line-height normal: 46 + 13")
	var ranking := o.find_child("Ranking", true, false) as Control
	assert_almost_eq(ranking.get_combined_minimum_size().y, 60.0, 0.01, "two 24 px rows 12 px apart")
	var reason := o.find_child("Reason", true, false) as Label
	assert_almost_eq(reason.get_theme_stylebox("normal").content_margin_right,
		float((reason.get_theme_font("font") as FontVariation).spacing_glyph), 0.01, "the trailing letter spacing")

func test_rows_list_players_by_kills() -> void:
	var o := _overlay()
	var ranking := o.find_child("Ranking", true, false)
	var top_name := ranking.get_child(0) as EffectText
	assert_eq(top_name.base_text(), "RA-1", "row 1: name column from the roster")
	assert_eq(top_name.kind(), "double", "the HUD streak effect stays on the name")
	var top_kills := ranking.get_child(1) as Label
	assert_eq(top_kills.text, str(TOP_KILLS), "row 1: kills column")
	assert_eq(top_kills.get_theme_color("font_color"), Color("#4af"), "kills in the player colour")
