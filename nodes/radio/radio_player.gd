class_name RadioPlayer extends Control
## The Radio mini-player docked on the menu screens — port of web components/RadioPlayer collapsed: a glass.ts card 300
## px wide (12 / 16 px padding, a 9 px gap) holding the track name — click it to open the radio — over prev /
## play-pause / next, the whole card shrunk to 0.8 into the corner 18 px from the right and 44 px from the bottom
## (transform-origin bottom right). Until the engine is ready the transport dims to 0.45 and lets the mouse through.
## The expanded Radio-screen player comes with that screen.

signal play_pause_requested
signal prev_requested
signal next_requested
signal open_requested

const WIDTH := 300.0
const RIGHT := 18.0
const BOTTOM := 44.0
const COLLAPSED_SCALE := 0.8
const PADDING := Vector2(16.0, 12.0)
const GAP := 9.0
const ROW_GAP := 8.0
const BUTTON_HEIGHT := 38.0
const BUTTON_RADIUS := 10
const BUTTON_BORDER_PX := 1
const BUTTON_BORDER := Color(1.0, 1.0, 1.0, 0.14)
const BUTTON_TEXT := Color("#ccdddd")          # #cdd
const BUTTON_PX := 16.8                        # 1.05rem
const TITLE_PX := 14.72                        # 0.92rem
const TITLE_SPACING_EM := 0.05
const TITLE_COLOR := Color("#eeeeff")          # #eef
const DIM_OPACITY := 0.45
const PREV_GLYPH := "⏮"
const PLAY_GLYPH := "▶"
const PAUSE_GLYPH := "⏸"
const NEXT_GLYPH := "⏭"
const SYMBOL_FAMILIES := ["Segoe UI Symbol"]   # the transport glyphs are not in the UI font (Chrome's system fallback)
const BUTTON_STATES := ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]
const TEXT_COLORS := ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color",
	"font_focus_color", "font_disabled_color"]
const HALF := 0.5

var _glass: GlassCard
var _title: CssLabel
var _row: Control
var _prev: CssButton
var _play: CssButton
var _next: CssButton
var _card := Vector2(WIDTH, 0.0)

func _init() -> void:
	name = "RadioPlayer"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glass = GlassCard.new()
	add_child(_glass)
	_title = CssLabel.new().styled(RadioModel.NO_TRACK, TITLE_PX, TITLE_SPACING_EM, TITLE_COLOR)
	_title.name = "TrackName"
	_title.mouse_filter = Control.MOUSE_FILTER_STOP   # the collapsed name opens the radio
	_title.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_title.gui_input.connect(_on_title_input)
	add_child(_title)
	_row = Control.new()
	_row.name = "Transport"
	_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_row)
	_prev = _button("Prev", PREV_GLYPH, prev_requested)
	_play = _button("PlayPause", PLAY_GLYPH, play_pause_requested)
	_next = _button("Next", NEXT_GLYPH, next_requested)
	scale = Vector2.ONE * COLLAPSED_SCALE
	_layout()

## What the player shows: the track label, whether the engine is ready, whether the radio is switched on.
func show_state(label: String, ready: bool, playing: bool) -> void:
	_title.text = label
	_play.text = PAUSE_GLYPH if playing else PLAY_GLYPH
	_row.modulate.a = 1.0 if ready else DIM_OPACITY
	for button in transport_buttons():
		(button as Control).mouse_filter = Control.MOUSE_FILTER_STOP if ready else Control.MOUSE_FILTER_IGNORE
	_layout()

func card_box() -> Vector2:
	return _card

func transport_buttons() -> Array:
	return [_prev, _play, _next]

func transport_row() -> Control:
	return _row

func title_text() -> String:
	return _title.text

func request_open() -> void:
	open_requested.emit()

func _notification(what: int) -> void:
	if what == NOTIFICATION_PARENTED:
		set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		_layout()

func _on_title_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		request_open()

func _layout() -> void:
	var left := GlassCard.BORDER_PX + PADDING.x
	var content_width := WIDTH - 2.0 * left
	var title_top := GlassCard.BORDER_PX + PADDING.y
	var title_box := _title.css_size()
	# text-overflow: ellipsis — a name wider than the card trims natively
	_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS if _title.run() != null \
		and _title.run().width() > content_width else TextServer.OVERRUN_NO_TRIMMING
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.position = Vector2(left, title_top)
	_title.size = Vector2(content_width, title_box.y)
	var row_top := title_top + title_box.y + GAP
	_row.position = Vector2(left, row_top)
	_row.size = Vector2(content_width, BUTTON_HEIGHT)
	var button_width := (content_width - ROW_GAP * (transport_buttons().size() - 1)) / transport_buttons().size()
	for i in transport_buttons().size():
		var button: CssButton = transport_buttons()[i]
		var x := i * (button_width + ROW_GAP)
		button.position = Vector2(CssPixel.snap(x), 0.0)
		button.size = Vector2(CssPixel.snap(x + button_width) - button.position.x, BUTTON_HEIGHT)
	_card = Vector2(WIDTH, row_top + BUTTON_HEIGHT + PADDING.y + GlassCard.BORDER_PX)
	_glass.set_box(_card)
	size = _card
	pivot_offset = _card                          # transform-origin: bottom right
	offset_right = -RIGHT
	offset_bottom = -BOTTOM
	offset_left = offset_right - _card.x
	offset_top = offset_bottom - _card.y

func _button(node_name: String, glyph: String, action: Signal) -> CssButton:
	var button := CssButton.new()
	button.name = node_name
	button.text = glyph
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var face := UiFont.base_with(SYMBOL_FAMILIES)
	var font_size := UiFont.css_size(BUTTON_PX)
	button.add_theme_font_override("font", UiFont.with_css_line(UiFont.spaced(0.0, font_size, BUTTON_PX, face), font_size,
		BUTTON_PX))
	button.add_theme_font_size_override("font_size", font_size)
	var box := StyleBoxFlat.new()   # appearance none, a hairline border on a 10 px radius, no hover look
	box.draw_center = false
	box.border_color = BUTTON_BORDER
	box.set_border_width_all(BUTTON_BORDER_PX)
	box.set_corner_radius_all(BUTTON_RADIUS)
	for state in BUTTON_STATES:
		button.add_theme_stylebox_override(state, box)
	for key in TEXT_COLORS:
		button.add_theme_color_override(key, BUTTON_TEXT)
	button.set_css_font(BUTTON_PX, 0.0, false, face)
	button.css_line_height = BUTTON_PX              # line-height: 1, centred by display: grid
	button.pressed.connect(func() -> void: action.emit())
	_row.add_child(button)
	return button
