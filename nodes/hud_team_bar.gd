class_name HudTeamBar extends VBoxContainer
## Match HUD top bar for three or more players — port of the web MatchHud multi-player branch + theme.css .mhud-*:
## the centred bar 30 px from the top with the timer between two player panes. A pane holds its players side by side
## (streak dots and frags in the player's colour around the grey .nm name with its streak effect, mirrored on the left
## pane; the web's underline for you never reaches the inline-block name) and, in
## Battle, the team total in the team colour with a glow, on the edge next to the timer. Sides never reorder by kills.

const PANE_GAP := 18                    # .mhud-team gap
const PANE_PADDING := Vector2(14.0, 6.0) # .mhud-team padding: 6px 14px
const ROW_GAP := 7                      # .mhud-row gap
const ROW_SPACING_EM := 0.06            # .mhud-row letter-spacing (the frags inherit it)
const ROW_FRAG_FONT_SIZE := 15          # .mhud-row .frag
const NAME_FONT_SIZE := HudTopBar.NAME_FONT_SIZE     # the name keeps .match-hud .nm: 16 px, 0.12em
const NAME_SPACING_EM := HudTopBar.NAME_SPACING_EM
const TOTAL_FONT_SIZE := 22             # .mhud-total
const TOTAL_GLOW_BLUR := 12.0           # text-shadow: 0 0 12px currentColor

## One player: dots + name + frags (mirrored on the right pane).
class Row extends HBoxContainer:
	var player_id := 0
	var name_text: EffectText
	var frag: Label
	var dots: Label

var _row: HBoxContainer
var _left: HBoxContainer                 # the panes' content, inside their padded frames
var _right: HBoxContainer
var _timer: Label
var _rows := {}                          # id -> Row
var _totals := {}                        # "left" / "right" -> GlowText
var _sides := {}
var _streaks := {}

func _ready() -> void:
	name = "TeamBar"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_theme_constant_override("separation", 0)
	var spacer := Control.new()
	spacer.custom_minimum_size.y = HudTopBar.TOP
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(spacer)
	_row = HBoxContainer.new()
	_row.name = "Row"
	_row.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_row.add_theme_constant_override("separation", HudTopBar.GAP)
	add_child(_row)
	_left = _pane("TeamLeft")
	_row.add_child(_left.get_parent())
	_row.add_child(_timer_frame())
	_right = _pane("TeamRight")
	_row.add_child(_right.get_parent())

## Build the panes for the match's players (roster entries), their teams (scores) and the local player.
func set_roster(entries: Array, scores: Array, local_id: int) -> void:
	_sides = TeamBarModel.sides(entries, scores, local_id)
	for pane in [_left, _right]:
		for child in pane.get_children():
			pane.remove_child(child)
			child.queue_free()
	_rows.clear()
	_totals.clear()
	for entry in _sides["left"]:
		_left.add_child(_player_row(entry, true))
	if _sides["battle"]:
		_totals["left"] = _total("TotalLeft")
		_left.add_child(_totals["left"])
		_totals["right"] = _total("TotalRight")
		_right.add_child(_totals["right"])
	for entry in _sides["right"]:
		_right.add_child(_player_row(entry, false))

## Frags, team totals, the timer and each player's streak (tier effect on the name, dots).
func set_state(scores: Array, time_text: String, streaks: Dictionary) -> void:
	_timer.text = time_text
	for id in _rows:
		var row: Row = _rows[id]
		row.frag.text = str(TeamBarModel.kills_of(id, scores))
		var streak: int = streaks.get(id, 0)
		if _streaks.get(id, -1) != streak:
			_streaks[id] = streak
			var tier := Streak.streak_tier(streak)
			row.name_text.show_text(row.name_text.base_text(), tier, row.frag.get_theme_color("font_color"))
			row.dots.text = HudTopBar.DOT.repeat(Overheat.streak_dots(streak))   # an empty span still takes its gap
	for side in _totals:
		var entries: Array = _sides[side]
		var total: GlowText = _totals[side]
		var color := TeamBarModel.team_color(entries, scores)
		total.set_text(str(TeamBarModel.team_kills(entries, scores)))
		total.set_color(color)
		total.set_shadows([CssShadow.make(TOTAL_GLOW_BLUR, color)])

func rows() -> Dictionary:
	return _rows

## The row name's face: the duel bar's .nm spacing in Chrome's line box.
static func name_font() -> FontVariation:
	return UiFont.with_css_line(UiFont.spaced(NAME_SPACING_EM, NAME_FONT_SIZE), NAME_FONT_SIZE)

## A pane's content row inside its padded frame (.mhud-team padding; its team tint is an invalid hex in web: no fill).
func _pane(node_name: String) -> HBoxContainer:
	var frame := PanelContainer.new()
	frame.name = "%sFrame" % node_name
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var padding := StyleBoxEmpty.new()
	padding.content_margin_left = PANE_PADDING.x
	padding.content_margin_right = PANE_PADDING.x
	padding.content_margin_top = PANE_PADDING.y
	padding.content_margin_bottom = PANE_PADDING.y
	frame.add_theme_stylebox_override("panel", padding)
	var pane := HBoxContainer.new()
	pane.name = node_name
	pane.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pane.add_theme_constant_override("separation", PANE_GAP)
	frame.add_child(pane)
	return pane

func _timer_frame() -> PanelContainer:
	var frame := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.draw_center = false
	box.border_width_left = HudTopBar.TIMER_BORDER
	box.border_width_right = HudTopBar.TIMER_BORDER
	box.border_color = HudTopBar.TIMER_BORDER_COLOR
	box.content_margin_left = HudTopBar.TIMER_PADDING
	box.content_margin_right = HudTopBar.TIMER_PADDING
	frame.add_theme_stylebox_override("panel", box)
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_timer = Label.new()
	_timer.name = "Timer"
	_timer.add_theme_font_override("font", UiFont.spaced(HudTopBar.TIMER_SPACING_EM, HudTopBar.TIMER_FONT_SIZE))
	_timer.add_theme_font_size_override("font_size", HudTopBar.TIMER_FONT_SIZE)
	_timer.add_theme_color_override("font_color", HudTopBar.TIMER_COLOR)
	frame.add_child(_timer)
	return frame

func _player_row(entry: Dictionary, mirror: bool) -> Row:
	var row := Row.new()
	var id: int = entry["id"]
	row.name = "Row%d" % id
	row.player_id = id
	row.alignment = BoxContainer.ALIGNMENT_END if mirror else BoxContainer.ALIGNMENT_BEGIN
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", ROW_GAP)
	var color := Color(entry.get("color", AppearanceConst.FALLBACK_TEXT_COLOR))
	row.dots = Label.new()
	row.dots.name = "Dots%d" % id
	row.dots.add_theme_font_override("font", UiFont.spaced(float(HudTopBar.DOT_SPACING_PX) / HudTopBar.DOT_FONT_SIZE,
		HudTopBar.DOT_FONT_SIZE))
	row.dots.add_theme_font_size_override("font_size", HudTopBar.DOT_FONT_SIZE)
	row.dots.add_theme_color_override("font_color", color)
	row.name_text = EffectText.new()
	row.name_text.name = "Name%d" % id
	row.name_text.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.frag = Label.new()
	row.frag.name = "Frag%d" % id
	row.frag.text = "0"
	var frag_font := UiFont.with_css_line(UiFont.spaced(ROW_SPACING_EM, ROW_FRAG_FONT_SIZE), ROW_FRAG_FONT_SIZE)
	row.frag.add_theme_font_override("font", frag_font)
	row.frag.add_theme_font_size_override("font_size", ROW_FRAG_FONT_SIZE)
	row.frag.add_theme_color_override("font_color", color)
	row.frag.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(frag_font))
	var cells: Array = [row.dots, row.name_text, row.frag]
	if not mirror:
		cells.reverse()
	for cell in cells:
		row.add_child(cell)
	# .nm grey; the player's colour drives the streak effect (the duel bar names the same way)
	row.name_text.configure(name_font(), NAME_FONT_SIZE, HudTopBar.NAME_COLOR)
	row.name_text.show_text(entry.get("name", ""), "", color)
	_rows[id] = row
	return row

func _total(node_name: String) -> GlowText:
	var total := GlowText.new()
	total.name = node_name
	total.mouse_filter = Control.MOUSE_FILTER_IGNORE
	total.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	total.configure(UiFont.with_css_line(UiFont.spaced(0.0, TOTAL_FONT_SIZE), TOTAL_FONT_SIZE), TOTAL_FONT_SIZE, Color.WHITE)
	total.set_text("0")
	return total
