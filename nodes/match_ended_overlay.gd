class_name MatchEndedOverlay extends CanvasLayer
## Match-end screen — port of web MatchEndedOverlay: a dimmed backdrop and one centred column with the outcome
## headline in its semantic colour (glowing), every player ranked by kills in their roster colour with the HUD streak
## effect kept on the name, the end reason and an exit to the menu. The primary button style arrives with the UI theme.

const LAYER := 20                                # above the HUD and the pause menu
const BACKDROP := Color8(7, 10, 14, 230)         # web rgba(7,10,14,0.9)
const TEXT_COLOR := Color("#cfe6ff")             # web --text
const REASON_COLOR := Color("#7a8694")
const OUTCOME_COLORS := {
	MatchResult.OUTCOME_WIN: Color("#44ffaa"),   # web --ok (#4fa)
	MatchResult.OUTCOME_LOSE: Color("#ff6666"),  # web --danger (#f66)
	MatchResult.OUTCOME_DRAW: Color("#ffdd44"),  # web #fd4
}
const OUTCOME_FONT_SIZE := 52
const RANK_NAME_FONT_SIZE := 18
const RANK_KILLS_FONT_SIZE := 22
const RANK_SPACING_EM := 0.12   # web rankingBox letter-spacing (names and kills)
const REASON_FONT_SIZE := 12
const REASON_SPACING_EM := 0.2
const COLUMN_GAP := 26          # web: gap between outcome, ranking, reason and exit
const RANK_COLUMNS := 2         # name | kills
const RANK_COLUMN_GAP := 28
const RANK_ROW_GAP := 12
const OUTCOME_SPACING_EM := 0.22   # web outcome letter-spacing
const GLOW_BLUR := 26.0            # web text-shadow 0 0 26px <outcome colour>
const FADE_S := 0.1             # web matchEndFade 0.1s
const EXIT_TEXT := "EXIT"       # web dictionary matchExit
const MAIN_MENU := "res://scenes/main_menu.tscn"

func _ready() -> void:
	layer = LAYER
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = false

## Show a MatchResult.compute() dictionary with the roster (names / colours) and the streak tier per id; the mouse
## is released so EXIT can be clicked.
func show_result(result: Dictionary, roster: Roster = null, tiers := {}) -> void:
	var dim := ColorRect.new()
	dim.color = BACKDROP
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", COLUMN_GAP)
	center.add_child(column)

	var outcome: String = result.get("outcome", "")
	var color: Color = OUTCOME_COLORS.get(outcome, TEXT_COLOR)
	var headline := GlowText.new()
	headline.name = "Outcome"
	headline.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(headline)
	headline.configure(UiFont.spaced(OUTCOME_SPACING_EM, OUTCOME_FONT_SIZE), OUTCOME_FONT_SIZE, color)
	headline.set_text(HudModel.outcome_label(outcome))
	headline.set_shadows([CssShadow.make(GLOW_BLUR, color)])

	column.add_child(_ranking(result.get("scores", []), roster if roster != null else Roster.new(), tiers))
	var reason := _label("Reason", HudModel.reason_label(result.get("reason", "")), REASON_FONT_SIZE, REASON_COLOR,
		REASON_SPACING_EM)
	reason.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(reason)

	var exit := Button.new()
	exit.name = "Exit"
	exit.text = EXIT_TEXT
	exit.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	exit.pressed.connect(_on_exit)
	UiSounds.attach(exit)
	column.add_child(exit)

	visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var tween := create_tween().set_parallel(true)
	for layer_node in [dim, center]:
		layer_node.modulate.a = 0.0
		tween.tween_property(layer_node, "modulate:a", 1.0, FADE_S)

## Two content-hugging columns centred as a block: names end at the shared edge, kills follow (web rankingBox).
func _ranking(scores: Array, roster: Roster, tiers: Dictionary) -> GridContainer:
	var grid := GridContainer.new()
	grid.name = "Ranking"
	grid.columns = RANK_COLUMNS
	grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	grid.add_theme_constant_override("h_separation", RANK_COLUMN_GAP)
	grid.add_theme_constant_override("v_separation", RANK_ROW_GAP)
	for row in HudModel.ranked_scores(scores):
		var id := int(row["id"])
		var player_color := roster.color_of(id)
		var player_name := EffectText.new()
		player_name.size_flags_horizontal = Control.SIZE_SHRINK_END
		player_name.size_flags_vertical = Control.SIZE_SHRINK_END
		grid.add_child(player_name)
		player_name.configure(UiFont.spaced(RANK_SPACING_EM, RANK_NAME_FONT_SIZE), RANK_NAME_FONT_SIZE, player_color)
		player_name.show_text(roster.name_of(id), tiers.get(id, ""), player_color)
		var kills := _label("", str(row["kills"]), RANK_KILLS_FONT_SIZE, player_color, RANK_SPACING_EM)
		kills.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		kills.size_flags_vertical = Control.SIZE_SHRINK_END
		grid.add_child(kills)
	return grid

func _label(node_name: String, text: String, font_size: int, color: Color, spacing_em: float) -> Label:
	var l := Label.new()
	if node_name != "":
		l.name = node_name
	l.text = text
	l.add_theme_font_override("font", UiFont.spaced(spacing_em, font_size))
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	return l

func _on_exit() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file(MAIN_MENU)
