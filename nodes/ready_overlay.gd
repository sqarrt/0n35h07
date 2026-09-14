class_name ReadyOverlay extends CanvasLayer
## The ready ritual — port of web components/ReadyOverlay with theme.css `.ready-*`: the blue / orange side tints, every
## player's name with READY ✓ / ○ NOT READY (two players: the top corners; more: a list around the screen's middle line;
## the local name underlined), the "[LMB] to start" hint (WAITING FOR OPPONENT once the local player has confirmed) and
## the controls legend at the bottom. A click anywhere confirms (`ready_requested`: the arena takes the pointer and marks
## the local player ready). It shows only in the ready phase.

signal ready_requested

const LAYER := 12                              # .ready-overlay z-index 12
const TINT_SHARE := 0.34                       # .ready-tint-l / -r: width 34%, 0.16 of the side's colour to transparent
const BLUE_TINT := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.16)
const ORANGE_TINT := Color(1.0, 170.0 / 255.0, 68.0 / 255.0, 0.16)
const TINT_STEPS := 256
const READY_KEY := "readyStatusReady"          # web dictionary keys
const NOT_READY_KEY := "readyStatusNotReady"
const HINT_KEY := "readyHintAction"
const WAITING_KEY := "readyWaiting"
const MOUSE_KEY := "keyLmb"
const CORNER_PLAYERS := 2                      # two players: the corners; three and more: the list
const CORNER_INSET := 18.0                     # .ready-corner top / left / right 18px
const NAME_PX := 13                            # .ready-corner 13px, spaced 0.12em
const NAME_SPACING_EM := 0.12
const STATUS_PX := 10                          # .ready-corner small: 10px, spaced 0.16em, margin-top 4px
const STATUS_SPACING_EM := 0.16
const STATUS_MARGIN_TOP := 4.0
const UNDERLINE_OFFSET := 3.0                  # textUnderlineOffset 3
const LIST_TOP := 64.0                         # the list: top 64, columns gap 12, rows gap 6
const LIST_COLUMN_GAP := 12.0
const LIST_ROW_GAP := 6.0
const LIST_NAME_PX := 16                       # the overlay's 16 px font, no letter spacing
const LIST_STATUS_PX := 13.333                 # <small>: font-size smaller
const HINT_PX := 15                            # .ready-hint: 15px, spaced 0.16em, gap 10px, centred on the screen
const HINT_SPACING_EM := 0.16
const HINT_GAP := 10.0
const KEY_PX := 13                             # .hkey: 13px (the hint's spacing inherited), padding 3px 9px, radius 3px
const KEY_SPACING_EM := HINT_SPACING_EM * HINT_PX / KEY_PX
const KEY_PADDING := Vector2(9.0, 3.0)
const KEY_BORDER_PX := 1
const KEY_RADIUS := 3
const KEY_FILL := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.1)
const KEY_TEXT := Color("#bbddff")
const LEGEND_BOTTOM := 14.0                    # .ready-legend: bottom 14px, padding 9px 14px, radius 6px
const LEGEND_PADDING := Vector2(14.0, 9.0)
const LEGEND_BORDER_PX := 1
const LEGEND_RADIUS := 6
const LEGEND_FILL := Color(10.0 / 255.0, 10.0 / 255.0, 15.0 / 255.0, 0.72)
const LEGEND_VIEWPORT_SHARE := 0.5             # left: 50% — the shrink-to-fit box gets half the screen
const HALF := 0.5

var _match: MatchNode
var _root: Control
var _names := {}                               # id -> UnderlinedLabel
var _statuses := {}                            # id -> Label
var _key: Panel
var _key_label: Label
var _hint_label: Label
var _waiting_label: Label
var _legend_box: Panel
var _legend: ControlsLegend
var _shown_ready: Array = []

func _ready() -> void:
	layer = LAYER
	_root = Control.new()
	_root.name = "Root"
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND   # .ready-overlay cursor: pointer
	_root.gui_input.connect(_on_input)
	add_child(_root)
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.resized.connect(_layout)
	_root.add_child(_tint("TintLeft", BLUE_TINT, false))
	_root.add_child(_tint("TintRight", ORANGE_TINT, true))
	_key = Panel.new()
	_key.name = "Key"
	_key.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_key.add_theme_stylebox_override("panel", _box(KEY_FILL, UiTokens.LINE, KEY_BORDER_PX, KEY_RADIUS))
	_root.add_child(_key)
	_key_label = MenuText.label("KeyText", I18n.t(MOUSE_KEY), KEY_PX, KEY_SPACING_EM, KEY_TEXT)
	_key.add_child(_key_label)
	_hint_label = MenuText.label("HintText", I18n.t(HINT_KEY), HINT_PX, HINT_SPACING_EM, UiTokens.TEXT)
	_root.add_child(_hint_label)
	_waiting_label = MenuText.label("Waiting", I18n.t(WAITING_KEY), HINT_PX, HINT_SPACING_EM, UiTokens.TEXT)
	_root.add_child(_waiting_label)
	_legend_box = Panel.new()
	_legend_box.name = "Legend"
	_legend_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_legend_box.add_theme_stylebox_override("panel", _box(LEGEND_FILL, UiTokens.SURFACE_LINE, LEGEND_BORDER_PX, LEGEND_RADIUS))
	_root.add_child(_legend_box)
	_legend = ControlsLegend.new()
	_legend_box.add_child(_legend)
	visible = false

## The match whose ritual this shows: its roster, local player, confirmed seats and phase.
func setup(match_node: MatchNode) -> void:
	_match = match_node
	var entries := match_node.roster.entries().duplicate()
	entries.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["id"] < b["id"])
	var corners := entries.size() <= CORNER_PLAYERS
	for entry in entries:
		var id: int = entry["id"]
		var name_label := UnderlinedLabel.new()
		name_label.name = "Name%d" % id
		_style(name_label, entry.get("name", ""), NAME_PX if corners else LIST_NAME_PX,
			NAME_SPACING_EM if corners else 0.0, match_node.roster.color_of(id))
		name_label.underline = id == match_node.local_id
		name_label.offset_px = UNDERLINE_OFFSET
		_root.add_child(name_label)
		_names[id] = name_label
		var status := Label.new()
		status.name = "Status%d" % id
		_style(status, "", STATUS_PX if corners else roundi(LIST_STATUS_PX), STATUS_SPACING_EM if corners else 0.0,
			UiTokens.MUTED, 0.0 if corners else LIST_STATUS_PX)
		_root.add_child(status)
		_statuses[id] = status
	refresh()

func _process(_delta: float) -> void:
	refresh()

## Re-read the phase and the confirmed seats.
func refresh() -> void:
	if _match == null:
		return
	visible = _match.is_ready_phase()
	if not visible:
		return
	var ready_ids := _match.ready_ids()
	if ready_ids == _shown_ready and not _shown_ready.is_empty():
		return
	_shown_ready = ready_ids
	for id in _statuses:
		var confirmed := ready_ids.has(id)
		var status := _statuses[id] as Label
		status.text = I18n.t(READY_KEY if confirmed else NOT_READY_KEY)
		status.add_theme_color_override("font_color", UiTokens.OK if confirmed else UiTokens.MUTED)
	var mine := ready_ids.has(_match.local_id)
	_key.visible = not mine
	_hint_label.visible = not mine
	_waiting_label.visible = mine
	_layout()

func _layout() -> void:
	var screen := _root.size
	for tint in [_root.get_node("TintLeft"), _root.get_node("TintRight")]:
		(tint as Control).size = Vector2(screen.x * TINT_SHARE, screen.y)
	(_root.get_node("TintRight") as Control).position.x = screen.x * (1.0 - TINT_SHARE)
	var ids := _names.keys()
	ids.sort()
	if ids.size() <= CORNER_PLAYERS:
		_layout_corners(ids, screen)
	else:
		_layout_list(ids, screen)
	_layout_hint(screen)
	var content := _legend.layout(screen.x * LEGEND_VIEWPORT_SHARE - 2.0 * (LEGEND_PADDING.x + LEGEND_BORDER_PX))
	var box := content + 2.0 * (LEGEND_PADDING + Vector2.ONE * LEGEND_BORDER_PX)
	_legend_box.size = box
	_legend_box.position = Vector2(CssPixel.snap((screen.x - box.x) * HALF), CssPixel.snap(screen.y - LEGEND_BOTTOM - box.y))
	_legend.position = LEGEND_PADDING + Vector2.ONE * LEGEND_BORDER_PX
	_legend.size = content

func _layout_corners(ids: Array, screen: Vector2) -> void:
	for i in ids.size():
		var name_label := _names[ids[i]] as Label
		var status := _statuses[ids[i]] as Label
		var name_box := name_label.get_combined_minimum_size()
		var status_box := status.get_combined_minimum_size()
		var right := i == 1                    # the second player takes the right corner, right-aligned
		var width := maxf(name_box.x, status_box.x)
		var left := screen.x - CORNER_INSET - width if right else CORNER_INSET
		SettingsRows.place(name_label, left + (width - name_box.x if right else 0.0), CORNER_INSET, name_box)
		SettingsRows.place(status, left + (width - status_box.x if right else 0.0),
			CORNER_INSET + name_box.y + STATUS_MARGIN_TOP, status_box)

func _layout_list(ids: Array, screen: Vector2) -> void:
	var middle := screen.x * HALF
	var y := LIST_TOP
	for id in ids:
		var name_label := _names[id] as Label
		var status := _statuses[id] as Label
		var name_box := name_label.get_combined_minimum_size()
		var status_box := status.get_combined_minimum_size()
		SettingsRows.place(name_label, middle - LIST_COLUMN_GAP * HALF - name_box.x, y, name_box)
		SettingsRows.place(status, middle + LIST_COLUMN_GAP * HALF, y, status_box)
		y += maxf(name_box.y, status_box.y) + LIST_ROW_GAP

## The hint centred by Chrome's fractional widths (Godot's whole-pixel advances would shift it).
func _layout_hint(screen: Vector2) -> void:
	var centre := screen * HALF
	if _waiting_label.visible:
		var waiting := _waiting_label.get_combined_minimum_size()
		var waiting_width := UiFont.css_width(_waiting_label.text, HINT_PX, HINT_SPACING_EM)
		SettingsRows.place(_waiting_label, centre.x - waiting_width * HALF, centre.y - waiting.y * HALF, waiting)
		return
	var key_text := _key_label.get_combined_minimum_size()
	var key_width := UiFont.css_width(_key_label.text, KEY_PX, KEY_SPACING_EM) + 2.0 * (KEY_PADDING.x + KEY_BORDER_PX)
	var key_height := key_text.y + 2.0 * (KEY_PADDING.y + KEY_BORDER_PX)
	var hint := _hint_label.get_combined_minimum_size()
	var hint_width := UiFont.css_width(_hint_label.text, HINT_PX, HINT_SPACING_EM)
	var height := maxf(key_height, hint.y)
	var left := centre.x - (key_width + HINT_GAP + hint_width) * HALF
	var top := centre.y - height * HALF
	_key.position = Vector2(CssPixel.snap(left), CssPixel.snap(top + (height - key_height) * HALF))
	_key.size = Vector2(CssPixel.snap(left + key_width) - _key.position.x, key_height)
	_key_label.position = KEY_PADDING + Vector2.ONE * KEY_BORDER_PX
	_key_label.size = key_text
	SettingsRows.place(_hint_label, left + key_width + HINT_GAP, top + (height - hint.y) * HALF, hint)

func _on_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click != null and click.button_index == MOUSE_BUTTON_LEFT and not click.pressed:   # web onClick
		ready_requested.emit()

func names() -> Dictionary:
	return _names

func statuses() -> Dictionary:
	return _statuses

func legend() -> ControlsLegend:
	return _legend

func _style(label: Label, text: String, font_px: int, spacing_em: float, color: Color, css_px := 0.0) -> void:
	label.text = text
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var font := UiFont.with_css_line(UiFont.spaced(spacing_em, font_px, css_px), font_px, css_px)
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", font_px)
	label.add_theme_color_override("font_color", color)
	label.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(font))

func _tint(node_name: String, color: Color, from_right: bool) -> TextureRect:
	var gradient := Gradient.new()
	var clear := Color(color, 0.0)                 # premultiplied CSS stops: the colour stays, the alpha falls to 0
	gradient.set_color(0, clear if from_right else color)
	gradient.set_color(1, color if from_right else clear)
	var texture := GradientTexture1D.new()
	texture.gradient = gradient
	texture.width = TINT_STEPS
	var rect := TextureRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	rect.texture = texture
	return rect

func _box(fill: Color, border: Color, border_px: int, radius: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = border
	box.set_border_width_all(border_px)
	box.set_corner_radius_all(radius)
	return box
