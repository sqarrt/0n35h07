class_name MatchEndedOverlay extends CanvasLayer
## Match-end screen — port of web MatchEndedOverlay: a dimmed backdrop and one centred flex column (CssColumn) with the
## outcome headline in its semantic colour (glowing), every player ranked by kills in their roster colour with the HUD
## streak effect kept on the name, the end reason and the primary EXIT button back to the menu.

const LAYER := 20                                # above the HUD and the pause menu
const BACKDROP := Color8(7, 10, 14, 230)         # web rgba(7,10,14,0.9)
const TEXT_COLOR := UiTokens.TEXT
const REASON_COLOR := Color("#7a8694")
const OUTCOME_COLORS := {
	MatchResult.OUTCOME_WIN: UiTokens.OK,
	MatchResult.OUTCOME_LOSE: UiTokens.DANGER,
	MatchResult.OUTCOME_DRAW: Color("#ffdd44"),  # web #fd4
}
const OUTCOME_FONT_SIZE := 52
const RANK_NAME_FONT_SIZE := 18
const RANK_KILLS_FONT_SIZE := 22
const RANK_SPACING_EM := 0.12   # web rankingBox letter-spacing (names and kills)
const REASON_FONT_SIZE := 12
const REASON_SPACING_EM := 0.2
const COLUMN_GAP := 26.0        # web: gap between outcome, ranking, reason and exit
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
	add_child(dim)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var column := CssColumn.new()
	column.name = "Column"
	column.gap = COLUMN_GAP
	add_child(column)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	var outcome: String = result.get("outcome", "")
	var color: Color = OUTCOME_COLORS.get(outcome, TEXT_COLOR)
	var headline := GlowText.new()
	headline.name = "Outcome"
	column.add(headline)
	headline.configure(UiFont.with_css_line(UiFont.bold_spaced(OUTCOME_SPACING_EM, OUTCOME_FONT_SIZE), OUTCOME_FONT_SIZE),
		OUTCOME_FONT_SIZE, color)   # web h1: bold; its padding-left of one spacing balances the trailing one
	headline.set_text(HudModel.outcome_label(outcome))
	headline.set_shadows([CssShadow.make(GLOW_BLUR, color)])

	column.add(_ranking(result.get("scores", []), roster if roster != null else Roster.new(), tiers))
	var reason := _label("Reason", HudModel.reason_label(result.get("reason", "")), REASON_FONT_SIZE, REASON_COLOR,
		REASON_SPACING_EM)
	reason.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add(reason)

	var exit := UiButton.new(EXIT_TEXT, UiButton.PRIMARY)
	exit.name = "Exit"
	exit.pressed.connect(_on_exit)
	column.add(exit, UiButton.MARGIN_Y, UiButton.MARGIN_Y)

	visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var tween := create_tween().set_parallel(true)
	for layer_node in [dim, column]:
		layer_node.modulate.a = 0.0
		tween.tween_property(layer_node, "modulate:a", 1.0, FADE_S)

## Two content-hugging columns centred as a block: names end at the shared edge, kills follow (web rankingBox).
func _ranking(scores: Array, roster: Roster, tiers: Dictionary) -> GridContainer:
	var grid := GridContainer.new()
	grid.name = "Ranking"
	grid.columns = RANK_COLUMNS
	grid.add_theme_constant_override("h_separation", RANK_COLUMN_GAP)
	grid.add_theme_constant_override("v_separation", RANK_ROW_GAP)
	for row in HudModel.ranked_scores(scores):
		var id := int(row["id"])
		var player_color := roster.color_of(id)
		var player_name := EffectText.new()
		player_name.size_flags_horizontal = Control.SIZE_SHRINK_END
		player_name.size_flags_vertical = Control.SIZE_SHRINK_END
		grid.add_child(player_name)
		player_name.configure(UiFont.with_css_line(UiFont.spaced(RANK_SPACING_EM, RANK_NAME_FONT_SIZE), RANK_NAME_FONT_SIZE),
			RANK_NAME_FONT_SIZE, player_color)
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
	var font := UiFont.with_css_line(UiFont.spaced(spacing_em, font_size), font_size)
	l.add_theme_font_override("font", font)
	l.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(font))
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	return l

func _on_exit() -> void:
	get_tree().change_scene_to_file(MAIN_MENU)
