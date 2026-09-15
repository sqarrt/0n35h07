class_name RadioScrub extends Control
## The expanded Radio player's scrub row — web RadioPlayer scrubRow: the play position as m:ss, an 18 px grab area
## holding a 4 px rail (white at 14%, the played share in the accent) with an 11 px #eef knob on the position, and the
## track's length; each time label at least 30 px, centred, 8 px from the rail, 0.6rem accent-dim spaced 0.04em. A press
## or a drag moves the knob; releasing seeks there (the bar keeps the dragged place until the next progress arrives).

signal seek_requested(fraction: float)

const HEIGHT := 18.0                            # SCRUB_HIT_HEIGHT
const GAP := 8.0
const TIME_MIN_WIDTH := 30.0
const TIME_PX := 9.6                            # 0.6rem
const TIME_SPACING_EM := 0.04
const RAIL_HEIGHT := 4.0                        # SCRUB_RAIL_HEIGHT, border-radius 4 (a capsule)
const RAIL_COLOR := Color(1.0, 1.0, 1.0, 0.14)
const THUMB_PX := 11.0                          # SCRUB_THUMB
const THUMB_COLOR := Color("#eeeeff")
const NO_DRAG := -1.0
const HALF := 0.5

var _elapsed: CssLabel
var _total: CssLabel
var _fraction := 0.0
var _total_ms := 0.0
var _drag := NO_DRAG

func _init() -> void:
	name = "Scrub"
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_elapsed = _time_label("Elapsed")
	_total = _time_label("Total")
	resized.connect(_layout)
	show_progress(0.0, 0.0)

## The play position (0..1) and the track's length in ms.
func show_progress(fraction: float, total_ms: float) -> void:
	_fraction = clampf(fraction, 0.0, 1.0)
	_total_ms = total_ms
	_elapsed.text = RadioPlayerFormat.fmt_ms(shown_fraction() * _total_ms)
	_total.text = RadioPlayerFormat.fmt_ms(_total_ms)
	_layout()

## The knob's place: the drag while one is on, else the play position.
func shown_fraction() -> float:
	return _drag if _drag != NO_DRAG else _fraction

func times() -> Array:
	return [_elapsed.text, _total.text]

## The grab area between the two time labels.
func rail_box() -> Rect2:
	var left := _time_width(_elapsed) + GAP
	var right := _time_width(_total) + GAP
	return Rect2(left, 0.0, maxf(0.0, size.x - left - right), size.y)

func _get_minimum_size() -> Vector2:
	return Vector2(0.0, HEIGHT)

func _draw() -> void:
	var box := rail_box()
	var rail := Rect2(box.position.x, (size.y - RAIL_HEIGHT) * HALF, box.size.x, RAIL_HEIGHT)
	_capsule(rail, RAIL_COLOR)
	var played := shown_fraction()
	if played > 0.0:
		_capsule(Rect2(rail.position, Vector2(rail.size.x * played, RAIL_HEIGHT)), UiTokens.ACCENT)
	draw_circle(Vector2(rail.position.x + rail.size.x * played, size.y * HALF), THUMB_PX * HALF, THUMB_COLOR, true, -1.0,
		true)

func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		if button.pressed and rail_box().has_point(button.position):
			_drag_to(button.position.x)
		elif not button.pressed and _drag != NO_DRAG:
			var target := _drag
			_fraction = target
			_drag = NO_DRAG
			seek_requested.emit(target)
			show_progress(_fraction, _total_ms)
		return
	var motion := event as InputEventMouseMotion
	if motion != null and _drag != NO_DRAG:
		_drag_to(motion.position.x)

func _drag_to(x: float) -> void:
	var box := rail_box()
	_drag = RadioPlayerFormat.fraction_from_pointer(x, box.position.x, box.size.x)
	show_progress(_fraction, _total_ms)

func _time_label(node_name: String) -> CssLabel:
	var label := CssLabel.new().styled("", TIME_PX, TIME_SPACING_EM, UiTokens.ACCENT_DIM)
	label.name = node_name
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER   # tabular numbers: the monospaced face already is
	add_child(label)
	return label

func _time_width(label: CssLabel) -> float:
	return maxf(TIME_MIN_WIDTH, label.css_size().x)

func _layout() -> void:
	for label: CssLabel in [_elapsed, _total]:
		var box := label.css_size()
		label.size = Vector2(_time_width(label), box.y)
		label.position.y = CssPixel.snap((size.y - box.y) * HALF)
	_elapsed.position.x = 0.0
	_total.position.x = size.x - _total.size.x
	queue_redraw()

func _capsule(rect: Rect2, color: Color) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.set_corner_radius_all(roundi(RAIL_HEIGHT * HALF))
	box.anti_aliasing = true
	draw_style_box(box, rect)
