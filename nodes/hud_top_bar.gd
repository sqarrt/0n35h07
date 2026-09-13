class_name HudTopBar extends VBoxContainer
## Match HUD top bar — port of web MatchHud (1v1) + theme.css .match-hud: your side · timer · opponent side,
## centred horizontally with its top edge 30px from the screen top. A side is 150px wide: name + frags (yours
## right-aligned, the opponent's mirrored); the timer sits between hairline borders. Player profiles
## (names / colours / streak dots) arrive later; defaults follow the web fallbacks.

const TOP := 30                              # web .match-hud top
const GAP := 18                              # web gap between side / timer / side
const SIDE_WIDTH := 150
const SIDE_GAP := 7
const NAME_FONT_SIZE := 16
const NAME_SPACING_EM := 0.12
const NAME_COLOR := Color("#8a93a0")
const FRAG_FONT_SIZE := 22
const TIMER_FONT_SIZE := 26
const TIMER_SPACING_EM := 0.08
const TIMER_COLOR := Color("#dfe9f5")
const TIMER_PADDING := 14
const TIMER_BORDER := 1
const TIMER_BORDER_COLOR := Color("#25303f")
const YOU_LABEL := "YOU"                     # web dictionary hudYou (fallback name)
const OPPONENT_LABEL := "OPPONENT"           # web dictionary hudOpponent
const YOU_COLOR := Color("#3377ff")          # web TEAM_COLORS[0] (#37f) until player profiles exist
const OPPONENT_COLOR := Color("#ff5533")     # web TEAM_COLORS[1] (#f53)

var _you_frags: Label
var _opp_frags: Label
var _timer: Label

func _ready() -> void:
	name = "TopBar"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)   # layout-driven: spacer + centred row
	add_theme_constant_override("separation", 0)

	var spacer := Control.new()
	spacer.custom_minimum_size.y = TOP
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(spacer)

	var row := HBoxContainer.new()
	row.name = "Row"
	row.size_flags_horizontal = Control.SIZE_SHRINK_CENTER   # web left: 50% + translateX(-50%)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", GAP)
	add_child(row)

	_you_frags = _frag_label(YOU_COLOR)
	row.add_child(_side([_name_label(YOU_LABEL), _you_frags], BoxContainer.ALIGNMENT_END))

	var frame := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.draw_center = false
	box.border_width_left = TIMER_BORDER
	box.border_width_right = TIMER_BORDER
	box.border_color = TIMER_BORDER_COLOR
	box.content_margin_left = TIMER_PADDING
	box.content_margin_right = TIMER_PADDING
	frame.add_theme_stylebox_override("panel", box)
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_timer = Label.new()
	_timer.name = "Timer"
	_timer.add_theme_font_override("font", UiFont.spaced(TIMER_SPACING_EM, TIMER_FONT_SIZE))
	_timer.add_theme_font_size_override("font_size", TIMER_FONT_SIZE)
	_timer.add_theme_color_override("font_color", TIMER_COLOR)
	frame.add_child(_timer)
	row.add_child(frame)

	_opp_frags = _frag_label(OPPONENT_COLOR)
	row.add_child(_side([_opp_frags, _name_label(OPPONENT_LABEL)], BoxContainer.ALIGNMENT_BEGIN))

## Frags for both sides and the timer text (HudModel.match_time).
func set_state(you_frags: int, opponent_frags: int, time_text: String) -> void:
	_you_frags.text = str(you_frags)
	_opp_frags.text = str(opponent_frags)
	_timer.text = time_text

func _side(children: Array, align: BoxContainer.AlignmentMode) -> HBoxContainer:
	var side := HBoxContainer.new()
	side.custom_minimum_size.x = SIDE_WIDTH
	side.alignment = align
	side.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	side.mouse_filter = Control.MOUSE_FILTER_IGNORE
	side.add_theme_constant_override("separation", SIDE_GAP)
	for child in children:
		side.add_child(child)
	return side

func _name_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", UiFont.spaced(NAME_SPACING_EM, NAME_FONT_SIZE))
	label.add_theme_font_size_override("font_size", NAME_FONT_SIZE)
	label.add_theme_color_override("font_color", NAME_COLOR)
	return label

func _frag_label(color: Color) -> Label:
	var label := Label.new()
	label.text = "0"
	label.add_theme_font_override("font", UiFont.base())
	label.add_theme_font_size_override("font_size", FRAG_FONT_SIZE)
	label.add_theme_color_override("font_color", color)
	return label
