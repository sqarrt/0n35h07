class_name MapTile extends Button
## A lobby map tile — port of web .lobby-maptiles .map-tile: a 1 px card (6 / 6 / 4 px padding, 5 px gap) with the
## square contained preview and the 9 px map id; selected: an accent border plus an inset accent ring and an accent
## label; under the mouse the border and label brighten (the hover border outranks the selected one in CSS).

const BORDER_PX := 1
const PADDING := Vector2(6.0, 6.0)             # padding: 6px 6px 4px
const PADDING_BOTTOM := 4.0
const GAP := 5.0
const LABEL_FONT_SIZE := 9
const LABEL_SPACING_EM := 0.02
const RING_PX := 1.0                           # box-shadow: 0 0 0 1px var(--accent) inset

var map_id := ""

var _on := false
var _preview: TextureRect
var _label: Label

func _init(id := "") -> void:
	map_id = id
	focus_mode = Control.FOCUS_NONE
	_preview = TextureRect.new()
	_preview.name = "Preview"
	_preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_preview.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if id != "" and ResourceLoader.exists(MapCatalog.preview_path(id)):
		_preview.texture = load(MapCatalog.preview_path(id))
	add_child(_preview)
	_label = Label.new()
	_label.name = "Label"
	_label.text = id
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var font := UiFont.with_css_line(UiFont.spaced(LABEL_SPACING_EM, LABEL_FONT_SIZE), LABEL_FONT_SIZE)
	_label.add_theme_font_override("font", font)
	_label.add_theme_font_size_override("font_size", LABEL_FONT_SIZE)
	add_child(_label)
	for state in ["normal", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	for state in ["hover", "hover_pressed"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	mouse_entered.connect(_restyle)
	mouse_exited.connect(_restyle)
	resized.connect(_layout)
	_restyle()

func set_on(on: bool) -> void:
	_on = on
	_restyle()

func is_on() -> bool:
	return _on

func label() -> Label:
	return _label

func preview() -> TextureRect:
	return _preview

func _draw() -> void:
	var border := UiTokens.GHOST_LINE_HOVER if is_hovered() else (UiTokens.ACCENT if _on else UiTokens.SURFACE_LINE)
	draw_rect(Rect2(Vector2.ONE * BORDER_PX * 0.5, size - Vector2.ONE * BORDER_PX), border, false, BORDER_PX)
	if _on:
		var inset := BORDER_PX + RING_PX * 0.5
		draw_rect(Rect2(Vector2.ONE * inset, size - Vector2.ONE * inset * 2.0), UiTokens.ACCENT, false, RING_PX)

func _preview_side() -> float:
	return maxf(size.x - 2.0 * (BORDER_PX + PADDING.x), 0.0)

func _chrome_height() -> float:
	return 2.0 * BORDER_PX + PADDING.y + GAP + PADDING_BOTTOM + _label.get_combined_minimum_size().y

func _layout() -> void:
	var side := _preview_side()
	_preview.position = Vector2(BORDER_PX + PADDING.x, BORDER_PX + PADDING.y)
	_preview.size = Vector2(side, side)
	var label_box := _label.get_combined_minimum_size()
	_label.size = Vector2(side, label_box.y)
	_label.position = Vector2(BORDER_PX + PADDING.x, BORDER_PX + PADDING.y + side + GAP)
	# Button sizes itself natively (the script _get_minimum_size is not consulted): the square preview sets the height
	custom_minimum_size.y = _chrome_height() + side

func _restyle() -> void:
	var color := UiTokens.TEXT if is_hovered() else (UiTokens.ACCENT if _on else UiTokens.MUTED)
	_label.add_theme_color_override("font_color", color)
	queue_redraw()
