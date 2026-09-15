class_name RadioCodeView extends Control
## The PROGRAM panel's code box — web RadioCodePanel codeBox: 12 / 16 px padding, the program (or "—") in Share Tech
## Mono 0.72rem spaced 0.02em at line-height 1.5, #bcd2ff under a 0 0 6px text-shadow of rgba(120,170,255,0.45), wrapped
## as Chrome wraps pre-wrap anywhere text (CssPreWrap) — narrower by the scrollbar once the program overflows. The
## scrollbar is the thin Windows one Chrome draws for theme.css's `scrollbar-width: thin`: a 10 px strip with 12 px arrow
## buttons and a 6 px rounded thumb, both rgba(47,111,158,0.35). The wheel scrolls; a click asks for a copy; the mouse
## over it draws an inset hairline, the copied state an accent one over rgba(120,180,255,0.12).

signal copy_requested

const PADDING := Vector2(16.0, 12.0)
const TEXT_COLOR := Color("#bcd2ff")
const GLOW_BLUR := 6.0
const GLOW_COLOR := Color(120.0 / 255.0, 170.0 / 255.0, 1.0, 0.45)
const EMPTY := "—"
const SCROLLBAR_PX := 10.0
const ARROW_PX := 12.0
const ARROW_SIZE := Vector2(6.0, 4.0)
const ARROW_INSET := 3.0                        # the arrow's tip from the strip's end
const THUMB_PX := 6.0
const THUMB_MIN := 17.0
const SCROLLBAR_COLOR := Color(47.0 / 255.0, 111.0 / 255.0, 158.0 / 255.0, 0.35)
const WHEEL_PX := 100.0
const HOVER_LINE := Color(120.0 / 255.0, 180.0 / 255.0, 1.0, 0.35)
const COPIED_FILL := Color(120.0 / 255.0, 180.0 / 255.0, 1.0, 0.12)
const LINE_PX := 1.0
const HALF := 0.5

var _code := ""
var _lines: Array = []
var _widths := {}
var _scroll := 0.0
var _hovered := false
var _copied := false
var _text: RadioCodeLines
var _mask_text: RadioCodeLines
var _glow: CssGlow

func _init() -> void:
	name = "Code"
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_text = _lines_control("Text", TEXT_COLOR)
	_mask_text = _lines_control("MaskText", Color.WHITE)
	_glow = CssGlow.new(self, _mask_text)
	_glow.set_shadows([CssShadow.make(GLOW_BLUR, GLOW_COLOR)])
	add_child(_text)
	resized.connect(_relayout)
	show_code("")

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		_glow.release()
	elif what == NOTIFICATION_MOUSE_ENTER or what == NOTIFICATION_MOUSE_EXIT:
		_hovered = what == NOTIFICATION_MOUSE_ENTER
		queue_redraw()

## The program to show ("—" when there is none); the box scrolls back to its top.
func show_code(code: String) -> void:
	if code == _code and not _lines.is_empty():
		return
	_code = code
	_scroll = 0.0
	_relayout()

func set_copied(copied: bool) -> void:
	_copied = copied
	queue_redraw()

func lines() -> Array:
	return _lines

func text_lines() -> RadioCodeLines:
	return _text

func glow() -> CssGlow:
	return _glow

## Whether the program is taller than the box (Chrome shows the scrollbar and wraps narrower).
func overflows() -> bool:
	return content_height() > size.y

func content_height() -> float:
	return 2.0 * PADDING.y + _lines.size() * RadioCodeLines.pitch()

func scroll_offset() -> float:
	return _scroll

func scroll_to(offset: float) -> void:
	_scroll = clampf(offset, 0.0, maxf(0.0, content_height() - size.y))
	_text.set_scroll(_scroll)
	_mask_text.set_scroll(_scroll)
	queue_redraw()

## The scrollbar thumb's box (empty without overflow).
func thumb_rect() -> Rect2:
	if not overflows():
		return Rect2()
	var track := size.y - 2.0 * ARROW_PX
	var length := maxf(THUMB_MIN, track * size.y / content_height())
	var travel := content_height() - size.y
	var top := ARROW_PX + (track - length) * (_scroll / travel if travel > 0.0 else 0.0)
	return Rect2(size.x - SCROLLBAR_PX + (SCROLLBAR_PX - THUMB_PX) * HALF, top, THUMB_PX, length)

func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button == null or not button.pressed:
		return
	match button.button_index:
		MOUSE_BUTTON_WHEEL_DOWN:
			scroll_to(_scroll + WHEEL_PX)
		MOUSE_BUTTON_WHEEL_UP:
			scroll_to(_scroll - WHEEL_PX)
		MOUSE_BUTTON_LEFT:
			if not (overflows() and button.position.x >= size.x - SCROLLBAR_PX):
				copy_requested.emit()

func _draw() -> void:
	var box := Rect2(Vector2.ZERO, size)
	if _copied:
		draw_rect(box, COPIED_FILL)
	if _copied or _hovered:
		draw_rect(box.grow(-LINE_PX * HALF), UiTokens.ACCENT if _copied else HOVER_LINE, false, LINE_PX)
	if overflows():
		_draw_scrollbar()

func _draw_scrollbar() -> void:
	var middle := size.x - SCROLLBAR_PX * HALF
	var top_tip := Vector2(middle, ARROW_INSET)
	draw_colored_polygon(PackedVector2Array([top_tip, top_tip + Vector2(ARROW_SIZE.x * HALF, ARROW_SIZE.y),
		top_tip + Vector2(-ARROW_SIZE.x * HALF, ARROW_SIZE.y)]), SCROLLBAR_COLOR)
	var bottom_tip := Vector2(middle, size.y - ARROW_INSET)
	draw_colored_polygon(PackedVector2Array([bottom_tip, bottom_tip - Vector2(ARROW_SIZE.x * HALF, ARROW_SIZE.y),
		bottom_tip - Vector2(-ARROW_SIZE.x * HALF, ARROW_SIZE.y)]), SCROLLBAR_COLOR)
	var thumb := StyleBoxFlat.new()
	thumb.bg_color = SCROLLBAR_COLOR
	thumb.set_corner_radius_all(roundi(THUMB_PX * HALF))
	draw_style_box(thumb, thumb_rect())

## Wrap at the full width, and again inside the scrollbar when the program overflows (Chrome's second layout pass).
func _relayout() -> void:
	var text := _code if not _code.is_empty() else EMPTY
	var width := size.x - 2.0 * PADDING.x
	_lines = CssPreWrap.lines(text, width, _advance)
	if overflows():
		_lines = CssPreWrap.lines(text, width - SCROLLBAR_PX, _advance)
	for control: RadioCodeLines in [_text, _mask_text]:
		control.left = PADDING.x
		control.top = PADDING.y
		control.show_lines(_lines)
	_text.size = size
	_glow.resize(size)
	scroll_to(_scroll)
	move_child(_text, get_child_count() - 1)

func _advance(character: String) -> float:
	if not _widths.has(character):
		_widths[character] = UiFont.css_width(character, RadioCodeLines.CODE_PX, RadioCodeLines.SPACING_EM)
	return _widths[character]

func _lines_control(node_name: String, color: Color) -> RadioCodeLines:
	var control := RadioCodeLines.new()
	control.name = node_name
	control.color = color
	control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return control
