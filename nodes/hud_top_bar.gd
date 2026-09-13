class_name HudTopBar extends VBoxContainer
## Match HUD top bar — port of web MatchHud (1v1) + theme.css .match-hud: your side · timer · opponent side,
## centred horizontally with its top edge 30px from the screen top. A side is 150px wide: streak dots + name + frags
## (yours right-aligned, the opponent's mirrored); the timer sits between hairline borders. Names come from the roster
## as EffectText with the player's streak tier; frags and dots take the player's colour.

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
const YOU_LABEL := "YOU"                     # web dictionary hudYou (name fallback without a roster entry)
const OPPONENT_LABEL := "OPPONENT"           # web dictionary hudOpponent
const DOT := "●"                             # web streak-dots glyph
const DOT_FONT_SIZE := 10                    # web .streak-dots font-size
const DOT_SPACING_PX := 1                    # web .streak-dots letter-spacing
const NO_STREAK := -1

var _you_frags: Label
var _opp_frags: Label
var _you_name: EffectText
var _opp_name: EffectText
var _you_dots: Label
var _opp_dots: Label
var _timer: Label
var _you := {}
var _opp := {}
var _you_streak := NO_STREAK
var _opp_streak := NO_STREAK

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

	_you_frags = _frag_label("YouFrags")
	_you_name = _name_text("YouName")
	_you_dots = _dots_label("YouDots")
	row.add_child(_side([_you_dots, _you_name, _you_frags], BoxContainer.ALIGNMENT_END))

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

	_opp_frags = _frag_label("OpponentFrags")
	_opp_name = _name_text("OpponentName")
	_opp_dots = _dots_label("OpponentDots")
	row.add_child(_side([_opp_frags, _opp_name, _opp_dots], BoxContainer.ALIGNMENT_BEGIN))
	set_players({}, {})

## Roster entries of both sides ({} = none: the web fallbacks YOU / OPPONENT and --text).
func set_players(you: Dictionary, opponent: Dictionary) -> void:
	_you = you
	_opp = opponent
	for side in [[_you_frags, _you_dots, you], [_opp_frags, _opp_dots, opponent]]:
		var color := _side_color(side[2])
		(side[0] as Label).add_theme_color_override("font_color", color)
		(side[1] as Label).add_theme_color_override("font_color", color)
	_show_streak(_you_name, _you_dots, _you, YOU_LABEL, maxi(_you_streak, 0))
	_show_streak(_opp_name, _opp_dots, _opp, OPPONENT_LABEL, maxi(_opp_streak, 0))

## Frags for both sides and the timer text (HudModel.match_time).
func set_state(you_frags: int, opponent_frags: int, time_text: String) -> void:
	_you_frags.text = str(you_frags)
	_opp_frags.text = str(opponent_frags)
	_timer.text = time_text

## Current kill streaks: the name takes the streak tier effect (web SET_STREAK), dots count the streak.
func set_streaks(you_streak: int, opponent_streak: int) -> void:
	if you_streak != _you_streak:
		_you_streak = you_streak
		_show_streak(_you_name, _you_dots, _you, YOU_LABEL, you_streak)
	if opponent_streak != _opp_streak:
		_opp_streak = opponent_streak
		_show_streak(_opp_name, _opp_dots, _opp, OPPONENT_LABEL, opponent_streak)

func _show_streak(player_name: EffectText, dots: Label, entry: Dictionary, fallback: String, streak: int) -> void:
	var label: String = entry.get("name", fallback)
	var tier := Streak.streak_tier(streak)
	if player_name.base_text() != label or tier != player_name.kind():   # same name and tier: the effect keeps running
		player_name.show_text(label, tier, Color(entry.get("color", AppearanceConst.FALLBACK_EFFECT_COLOR)))
	var count := Overheat.streak_dots(streak)
	dots.text = DOT.repeat(count)
	dots.visible = count > 0

## web `.side { color: entry.color }`; without an entry the text colour is inherited (--text).
func _side_color(entry: Dictionary) -> Color:
	return Color(entry.get("color", AppearanceConst.FALLBACK_TEXT_COLOR))

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

func _name_text(node_name: String) -> EffectText:
	var text := EffectText.new()
	text.name = node_name
	text.size_flags_vertical = Control.SIZE_SHRINK_CENTER   # web .side align-items: center
	text.configure(UiFont.spaced(NAME_SPACING_EM, NAME_FONT_SIZE), NAME_FONT_SIZE, NAME_COLOR)
	return text

func _dots_label(node_name: String) -> Label:
	var label := Label.new()
	label.name = node_name
	label.add_theme_font_override("font", UiFont.spaced(float(DOT_SPACING_PX) / DOT_FONT_SIZE, DOT_FONT_SIZE))
	label.add_theme_font_size_override("font_size", DOT_FONT_SIZE)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return label

func _frag_label(node_name: String) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = "0"
	label.add_theme_font_override("font", UiFont.base())
	label.add_theme_font_size_override("font_size", FRAG_FONT_SIZE)
	return label
