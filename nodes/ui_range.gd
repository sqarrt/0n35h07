class_name UiRange extends Control
## The bare volume range — web theme.css `.slider` on an `<input type="range">`: a 6 px track (surface-line fill in a 1 px
## line border) with a 14×18 accent-dim thumb (accent-bright under the mouse or while dragged) travelling inside the
## track's border and centred on it, like Chrome's range input; 0..1 in whole percent steps (web range 0..100). The
## control's box is what takes the mouse: the track's width, the thumb's height, the track centred in it.

signal value_changed(value: float)

const TRACK_HEIGHT := 6.0
const TRACK_BORDER := 1.0
const THUMB_SIZE := Vector2(14.0, 18.0)
const PERCENT_MAX := 100.0
const HALF := 0.5

var value := 0.0

var _hovered := false
var _dragging := false

func _init(initial := 0.0) -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_value(initial)

func set_value(fraction: float) -> void:
	value = roundf(clampf(fraction, 0.0, 1.0) * PERCENT_MAX) / PERCENT_MAX
	queue_redraw()

## The track centred in the box.
func track_rect() -> Rect2:
	return Rect2(0.0, (size.y - TRACK_HEIGHT) * HALF, size.x, TRACK_HEIGHT)

func thumb_rect() -> Rect2:
	var inner := track_rect().grow(-TRACK_BORDER)
	return Rect2(inner.position.x + (inner.size.x - THUMB_SIZE.x) * value,
		inner.position.y + (inner.size.y - THUMB_SIZE.y) * HALF, THUMB_SIZE.x, THUMB_SIZE.y)

func is_lit() -> bool:
	return _hovered or _dragging

func _get_minimum_size() -> Vector2:
	return Vector2(0.0, THUMB_SIZE.y)

func _draw() -> void:
	var track := _snapped(track_rect())
	draw_rect(track, UiTokens.SURFACE_LINE)
	draw_rect(track.grow(-TRACK_BORDER * HALF), UiTokens.LINE, false, TRACK_BORDER)
	draw_rect(_snapped(thumb_rect()), UiTokens.ACCENT_BRIGHT if is_lit() else UiTokens.ACCENT_DIM)

func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		_dragging = button.pressed
		if _dragging:
			_drag_to(button.position.x)
		queue_redraw()
		return
	var motion := event as InputEventMouseMotion
	if motion != null and _dragging:
		_drag_to(motion.position.x)

func _notification(what: int) -> void:
	match what:
		NOTIFICATION_MOUSE_ENTER:
			_hovered = true
			queue_redraw()
		NOTIFICATION_MOUSE_EXIT:
			_hovered = false
			queue_redraw()

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
