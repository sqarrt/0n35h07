class_name UiSlider extends Control
## Volume slider — port of web ui/Slider with theme.css `.slider`: the field label, 8 px below it an 18rem row with a
## 6 px track (surface-line fill in a 1 px line border), a 14×18 accent-dim thumb (accent-bright under the mouse) and the
## percentage right-aligned in a 4ch box 0.8rem after the track. 0..1 in whole percent steps (web range 0..100); the
## thumb travels inside the track's border and centres on it, like Chrome's range input.

signal value_changed(value: float)

const LABEL_MARGIN_BOTTOM := 8.0          # 0.5rem
const ROW_WIDTH := 288.0                  # 18rem
const ROW_GAP := 12.8                     # 0.8rem
const VALUE_PX := 12.0                    # 0.75rem
const VALUE_CHARS := 4.0                  # width: 4ch
const ZERO_GLYPH := "0"                   # a CSS ch is the advance of "0"
const TRACK_HEIGHT := 6.0
const TRACK_BORDER := 1.0
const THUMB_SIZE := Vector2(14.0, 18.0)
const PERCENT_MAX := 100.0
const PERCENT_FORMAT := "%d%%"
const HALF := 0.5

var value := 0.0

var _label: Label
var _value_label: Label
var _hovered := false
var _dragging := false

func _init(caption := "", initial := 0.0) -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_label = MenuText.field_label("Label", caption)
	add_child(_label)
	_value_label = MenuText.label("Value", "", VALUE_PX, 0.0, UiTokens.ACCENT_DIM)
	_value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_value_label)
	set_value(initial)
	resized.connect(_layout)

func set_value(fraction: float) -> void:
	value = roundf(clampf(fraction, 0.0, 1.0) * PERCENT_MAX) / PERCENT_MAX
	_value_label.text = PERCENT_FORMAT % roundi(value * PERCENT_MAX)
	queue_redraw()

func label() -> Label:
	return _label

func value_label() -> Label:
	return _value_label

## The row under the label: the track, the gap and the 4ch percentage.
func row_top() -> float:
	return _label.get_combined_minimum_size().y + LABEL_MARGIN_BOTTOM

## 4ch at Chrome's fractional advance (Godot rounds a glyph's advance to a pixel: 7 px for 6.48), measured large.
func value_width() -> float:
	var font := _value_label.get_theme_font("font")
	var advance := font.get_string_size(ZERO_GLYPH, HORIZONTAL_ALIGNMENT_LEFT, -1, UiFont.MEASURE_PX).x
	return VALUE_CHARS * advance * VALUE_PX / UiFont.MEASURE_PX

func track_rect() -> Rect2:
	var row_height := _value_label.get_combined_minimum_size().y
	var width := ROW_WIDTH - ROW_GAP - value_width()
	return Rect2(0.0, row_top() + (row_height - TRACK_HEIGHT) * HALF, width, TRACK_HEIGHT)

func thumb_rect() -> Rect2:
	var inner := track_rect().grow(-TRACK_BORDER)
	return Rect2(inner.position.x + (inner.size.x - THUMB_SIZE.x) * value,
		inner.position.y + (inner.size.y - THUMB_SIZE.y) * HALF, THUMB_SIZE.x, THUMB_SIZE.y)

func _get_minimum_size() -> Vector2:
	return Vector2(ROW_WIDTH, row_top() + _value_label.get_combined_minimum_size().y)

func _layout() -> void:
	_label.position = Vector2.ZERO
	_label.size = _label.get_combined_minimum_size()
	var track := track_rect()
	_value_label.position = Vector2(CssPixel.snap(track.end.x + ROW_GAP), row_top())
	_value_label.size = Vector2(value_width(), _value_label.get_combined_minimum_size().y)

func _draw() -> void:
	var track := _snapped(track_rect())
	draw_rect(track, UiTokens.SURFACE_LINE)
	draw_rect(track.grow(-TRACK_BORDER * HALF), UiTokens.LINE, false, TRACK_BORDER)
	draw_rect(_snapped(thumb_rect()), UiTokens.ACCENT_BRIGHT if _hovered or _dragging else UiTokens.ACCENT_DIM)

func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		_dragging = button.pressed and _hit_rect().has_point(button.position)
		if _dragging:
			_drag_to(button.position.x)
		queue_redraw()
		return
	var motion := event as InputEventMouseMotion
	if motion != null:
		var hovered := _hit_rect().has_point(motion.position)
		if hovered != _hovered:
			_hovered = hovered
			queue_redraw()
		if _dragging:
			_drag_to(motion.position.x)

func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_EXIT and _hovered:
		_hovered = false
		queue_redraw()

## The input's box: the track widened to the thumb's height.
func _hit_rect() -> Rect2:
	var track := track_rect()
	var thumb := thumb_rect()
	return Rect2(track.position.x, thumb.position.y, track.size.x, thumb.size.y)

func _drag_to(x: float) -> void:
	var inner := track_rect().grow(-TRACK_BORDER)
	var before := value
	set_value((x - inner.position.x - THUMB_SIZE.x * HALF) / (inner.size.x - THUMB_SIZE.x))
	if value != before:
		value_changed.emit(value)

func _snapped(rect: Rect2) -> Rect2:
	var left := CssPixel.snap(rect.position.x)
	var top := CssPixel.snap(rect.position.y)
	return Rect2(left, top, CssPixel.snap(rect.end.x) - left, CssPixel.snap(rect.end.y) - top)
