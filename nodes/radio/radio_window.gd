class_name RadioWindow extends Control
## A floating window of the Radio screen — web RadioExplorer.css `.rexp` with useWindowChrome (the PROGRAM panel; the
## library explorer comes with R4): glass.ts's frosted surface under a 0 18px 60px shadow and a 30 px accent glow,
## clipped to its 14 px corners; a 30 px title bar (an accent gradient over a 1 px surface-line rule, 8 px padding and
## gaps) with the glowing uppercase title (13 px spaced 2 px, text-shadow 0 0 10px) wrapped by words when the buttons
## leave it too little room, and the _ ▢ ✕ buttons (22×19, 3 px radius, ghost-line and muted; ✕ in red); the content
## under the bar; the 16 px resize corner. The bar drags the window, the corner resizes it down to its minimum, ▢ fills
## the screen but 8 px and back — geometry moves over 0.26 s cubic-bezier(.2,.8,.2,1) unless a drag is on — and _ or ✕
## asks to minimize.

signal minimize_requested

const BORDER_PX := GlassCard.BORDER_PX
const TITLE_HEIGHT := 30.0                     # the bar with its rule
const RULE_PX := 1.0
const TITLE_PADDING := 8.0
const TITLE_GAP := 8.0
const TITLE_GRADIENT_TOP_ALPHA := 0.12
const TITLE_GRADIENT_BOTTOM_ALPHA := 0.03
const TITLE_PX := 13.0
const TITLE_SPACING_PX := 2.0
const TITLE_GLOW_BLUR := 10.0
const TITLE_GLOW_ALPHA := 0.5
const TITLE_WORD := " "
const BUTTON_SIZE := Vector2(22.0, 19.0)
const BUTTON_RADIUS := 3
const BUTTON_PX := 11.0
const BUTTON_HOVER_FILL_ALPHA := 0.16
const CLOSE_BORDER := Color("#5a2b33")
const CLOSE_TEXT := Color("#cc7777")
const CLOSE_HOVER_FILL := Color(1.0, 0.4, 0.4, 0.2)
const CLOSE_HOVER_TEXT := Color("#ff9999")
const CLOSE_HOVER_BORDER := Color("#b85563")
const MINIMIZE_GLYPH := "_"
const MAXIMIZE_GLYPH := "▢"
const CLOSE_GLYPH := "✕"
const SYMBOL_FAMILIES := ["Segoe UI Symbol"]   # ▢ ✕ are not in the UI font
const SHADOW_OFFSET := Vector2(0.0, 18.0)
const SHADOW_BLUR := 60.0
const GLOW_BLUR := 30.0
const GLOW_ALPHA := 0.14
const RADIUS := GlassCard.RADIUS
const CORNER_PX := 16.0
const MAXIMIZED_MARGIN := 8.0
const GEOMETRY_S := 0.26
const GEOMETRY_CURVE := [0.2, 0.8, 0.2, 1.0]
const CHROME_SHADER := preload("res://assets/shaders/radio_window_chrome.gdshader")
const HOVER_STATES := ["hover", "hover_pressed"]
const HOVER_COLORS := ["font_hover_color", "font_hover_pressed_color"]
const HALF := 0.5
const MOVE := "move"
const RESIZE := "resize"

var minimum := Vector2.ZERO

var _glow: ColorRect
var _glass: GlassCard
var _chrome: ColorRect
var _title_lines: Array[GlowText] = []
var _title := ""
var _minimize: CssButton
var _maximize: CssButton
var _close: CssButton
var _content: Control
var _corner: Control
var _geometry := Rect2()
var _maximized := false
var _live := false
var _drag_mode := ""
var _drag_from := Vector2.ZERO
var _drag_start := Rect2()
var _frame: Array[CssTransition] = []

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_glow = CssBoxShadow.make(Color(UiTokens.ACCENT, GLOW_ALPHA), GLOW_BLUR, Vector2.ZERO, 0.0, RADIUS)
	add_child(_glow)
	_glass = GlassCard.new()
	add_child(_glass)
	_glass.set_shadow(SHADOW_OFFSET, SHADOW_BLUR, 0.0)
	_content = Control.new()
	_content.name = "Content"
	_content.clip_contents = true
	_content.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(_content)
	_chrome = ColorRect.new()
	_chrome.name = "Chrome"
	_chrome.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = CHROME_SHADER
	material.set_shader_parameter("radius_px", RADIUS - BORDER_PX)
	material.set_shader_parameter("title_px", TITLE_HEIGHT)
	material.set_shader_parameter("rule_px", RULE_PX)
	material.set_shader_parameter("top_color", Color(UiTokens.ACCENT, TITLE_GRADIENT_TOP_ALPHA))
	material.set_shader_parameter("bottom_color", Color(UiTokens.ACCENT, TITLE_GRADIENT_BOTTOM_ALPHA))
	material.set_shader_parameter("rule_color", UiTokens.SURFACE_LINE)
	material.set_shader_parameter("corner_px", CORNER_PX)
	material.set_shader_parameter("stripe_color", UiTokens.LINE)
	_chrome.material = material
	add_child(_chrome)
	var bar := Control.new()
	bar.name = "TitleBar"
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	bar.mouse_default_cursor_shape = Control.CURSOR_MOVE
	bar.gui_input.connect(func(event: InputEvent) -> void: _on_drag_input(event, MOVE))
	add_child(bar)
	_minimize = _window_button("Minimize", MINIMIZE_GLYPH, [], false)
	_maximize = _window_button("Maximize", MAXIMIZE_GLYPH, SYMBOL_FAMILIES, false)
	_close = _window_button("Close", CLOSE_GLYPH, SYMBOL_FAMILIES, true)
	_minimize.pressed.connect(func() -> void: minimize_requested.emit())
	_close.pressed.connect(func() -> void: minimize_requested.emit())
	_maximize.pressed.connect(toggle_maximized)
	_corner = Control.new()
	_corner.name = "ResizeCorner"
	_corner.mouse_filter = Control.MOUSE_FILTER_STOP
	_corner.mouse_default_cursor_shape = Control.CURSOR_FDIAGSIZE
	_corner.gui_input.connect(func(event: InputEvent) -> void: _on_drag_input(event, RESIZE))
	add_child(_corner)
	for i in 4:
		_frame.append(CssTransition.new(GEOMETRY_S, GEOMETRY_CURVE))
	set_process(false)

## The title, the window's place and size, and the smallest size a resize may leave.
func setup(title: String, geometry: Rect2, minimum_size: Vector2) -> void:
	minimum = minimum_size
	_geometry = geometry
	_snap_frame()
	set_title(title)

## The title bar's text (shown uppercase).
func set_title(text: String) -> void:
	_title = text.to_upper()
	_layout()

func content() -> Control:
	return _content

func buttons() -> Array:
	return [_minimize, _maximize, _close]

func title_lines() -> Array[GlowText]:
	return _title_lines

func geometry() -> Rect2:
	return _geometry

func is_maximized() -> bool:
	return _maximized

## The frame the window shows: the geometry, or the screen but the margin, as the transition has it now.
func frame() -> Rect2:
	return Rect2(_frame[0].value, _frame[1].value, _frame[2].value, _frame[3].value)

## ▢: fill the screen but 8 px, or go back to the geometry.
func toggle_maximized() -> void:
	_maximized = not _maximized
	_corner.visible = not _maximized
	_retarget()

## A drag on the title bar (MOVE) or the corner (RESIZE) from a global mouse position; no drag while maximized.
func start_drag(mode: String, global_from: Vector2) -> void:
	if _maximized:
		return
	_drag_mode = mode
	_drag_from = global_from
	_drag_start = _geometry
	_live = true

func drag_to(global_at: Vector2) -> void:
	if _drag_mode.is_empty():
		return
	var moved := global_at - _drag_from
	if _drag_mode == MOVE:
		_geometry = Rect2(_drag_start.position + moved, _drag_start.size)
	else:
		_geometry = Rect2(_drag_start.position, (_drag_start.size + moved).max(minimum))
	_snap_frame()

func end_drag() -> void:
	_drag_mode = ""
	_live = false

func _process(delta: float) -> void:
	for transition in _frame:
		transition.advance(delta)
	_apply_frame()
	if _frame.all(func(t: CssTransition) -> bool: return is_equal_approx(t.value, t.target())):
		set_process(false)

func _on_drag_input(event: InputEvent, mode: String) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		if button.pressed:
			start_drag(mode, button.global_position)
		else:
			end_drag()
		return
	var motion := event as InputEventMouseMotion
	if motion != null:
		drag_to(motion.global_position)

## The frame's target: the geometry, or the maximized box; animated unless a drag is on.
func _retarget() -> void:
	var target := _target()
	var values := [target.position.x, target.position.y, target.size.x, target.size.y]
	for i in 4:
		if _live:
			_frame[i].snap(values[i])
		else:
			_frame[i].set_target(values[i])
	set_process(not _live)
	_apply_frame()

func _snap_frame() -> void:
	var target := _target()
	var values := [target.position.x, target.position.y, target.size.x, target.size.y]
	for i in 4:
		_frame[i].snap(values[i])
	_apply_frame()

func _target() -> Rect2:
	if _maximized:
		var screen := get_parent_area_size()
		return Rect2(Vector2.ONE * MAXIMIZED_MARGIN, screen - Vector2.ONE * 2.0 * MAXIMIZED_MARGIN)
	return _geometry

func _apply_frame() -> void:
	var box := frame()
	position = box.position
	size = box.size
	_layout()

func _layout() -> void:
	if _corner == null:
		return
	var box := size
	CssBoxShadow.place(_glow, Vector2.ZERO, box)
	_glass.set_box(box)
	var inner := box - Vector2.ONE * 2.0 * BORDER_PX
	_chrome.position = Vector2.ONE * BORDER_PX
	_chrome.size = inner
	var chrome := _chrome.material as ShaderMaterial
	chrome.set_shader_parameter("box_px", inner)
	chrome.set_shader_parameter("show_corner", not _maximized)
	var bar := find_child("TitleBar", false, false) as Control
	bar.position = Vector2.ONE * BORDER_PX
	bar.size = Vector2(inner.x, TITLE_HEIGHT)
	_content.position = Vector2(BORDER_PX, BORDER_PX + TITLE_HEIGHT)
	_content.size = Vector2(inner.x, maxf(0.0, inner.y - TITLE_HEIGHT))
	_corner.size = Vector2.ONE * CORNER_PX
	_corner.position = box - Vector2.ONE * BORDER_PX - _corner.size
	var bar_content := TITLE_HEIGHT - RULE_PX
	var right := BORDER_PX + inner.x - TITLE_PADDING
	for button: CssButton in [_close, _maximize, _minimize]:
		right -= BUTTON_SIZE.x
		button.position = Vector2(right, BORDER_PX + CssPixel.snap((bar_content - BUTTON_SIZE.y) * HALF))
		button.size = BUTTON_SIZE
		right -= TITLE_GAP
	# flex: the title, a growing spacer, then the buttons — all 8 px apart
	var room := inner.x - 2.0 * TITLE_PADDING - buttons().size() * (BUTTON_SIZE.x + TITLE_GAP) - TITLE_GAP
	_lay_title(_wrap_title(room), bar_content)

## The title's lines in `room` px: whole words, a word too long for a line alone on its own.
func _wrap_title(room: float) -> PackedStringArray:
	var lines := PackedStringArray()
	var line := ""
	for word in _title.split(TITLE_WORD, false):
		var candidate := word if line.is_empty() else line + TITLE_WORD + word
		if line.is_empty() or UiFont.css_width(candidate, TITLE_PX, TITLE_SPACING_PX / TITLE_PX) <= room:
			line = candidate
		else:
			lines.append(line)
			line = word
	if not line.is_empty():
		lines.append(line)
	return lines

func _lay_title(lines: PackedStringArray, bar_content: float) -> void:
	while _title_lines.size() < lines.size():
		var glow := GlowText.new()
		glow.name = "Title%d" % _title_lines.size()
		glow.configure_css(TITLE_PX, TITLE_SPACING_PX / TITLE_PX, UiTokens.ACCENT)
		glow.set_shadows([CssShadow.make(TITLE_GLOW_BLUR, Color(UiTokens.ACCENT, TITLE_GLOW_ALPHA))])
		add_child(glow)
		_title_lines.append(glow)
	var line_px := roundi(UiFont.ASCENT_EM * TITLE_PX) + roundi(UiFont.DESCENT_EM * TITLE_PX)
	var top := BORDER_PX + floorf((bar_content - line_px * lines.size()) * HALF)
	for i in _title_lines.size():
		var glow := _title_lines[i]
		glow.visible = i < lines.size()
		if glow.visible:
			glow.set_text(lines[i])
			glow.position = Vector2(BORDER_PX + TITLE_PADDING, top + i * line_px)

## web .rexp-wbtn: the glyph centred in its line box (the symbol face's when it draws it), hover lit.
func _window_button(node_name: String, glyph: String, families: Array, closing: bool) -> CssButton:
	var button := CssButton.new()
	button.name = node_name
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var border := CLOSE_BORDER if closing else UiTokens.GHOST_LINE
	RadioButtons.dress(button, RadioButtons.outline(border, BUTTON_RADIUS), CLOSE_TEXT if closing else UiTokens.MUTED)
	var hover := RadioButtons.outline(CLOSE_HOVER_BORDER if closing else UiTokens.LINE, BUTTON_RADIUS,
		CLOSE_HOVER_FILL if closing else Color(UiTokens.ACCENT, BUTTON_HOVER_FILL_ALPHA))
	for state in HOVER_STATES:
		button.add_theme_stylebox_override(state, hover)
	for key in HOVER_COLORS:
		button.add_theme_color_override(key, CLOSE_HOVER_TEXT if closing else UiTokens.ACCENT_DIM)
	RadioButtons.set_font(button, BUTTON_PX, 0.0, families)
	var inner := BUTTON_SIZE.y - 2.0 * RadioButtons.BORDER_PX
	var line := UiFont.fallback_line_px(BUTTON_PX, families)
	button.css_baseline = RadioButtons.BORDER_PX + roundf((inner - line) * HALF) + UiFont.fallback_ascent_px(BUTTON_PX, families)
	button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	button.text = glyph
	add_child(button)
	return button
