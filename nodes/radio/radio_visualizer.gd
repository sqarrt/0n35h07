class_name RadioVisualizer extends Control
## The LIBRARY window's living background — web components/RadioVisualizer: a transparent canvas the size of the window's
## padding box, drawn additively ('lighter') and shown at half opacity under the window's chrome, clipped to its corners.
## Four pictures of the RadioVizState: SCOPE (three Lissajous traces, a soft 2 px pass then a bright 1 px pass),
## BARS (24 centred bars), RADIAL (24 round-capped spokes turning with the phase) and FIELD (90 drifting dots); AUTO
## rotates them. It runs only while active (the radio on and the window shown) or pinned by a capture.

const LIGHTER_SHADER := preload("res://assets/shaders/viz_lighter.gdshader")
const COMPOSITE_SHADER := preload("res://assets/shaders/viz_composite.gdshader")
const OPACITY := 0.5                            # .rexp-vis
const CLIP_RADIUS := 13.0                       # the window's 14 px corner inside its 1 px border
const SEGMENTS := 360
const FULL_TURN := TAU
const SCOPE_SIZE := 0.16
const SCOPE_BASE := 0.66
const SCOPE_BASS := 1.0
const SCOPE_LEVEL := 0.5
const SCOPE_PUNCH := 0.55
const SCOPE_GROUPS := [[0.5, 1.25], [0.52, 1.35], [0.44, 1.6]]   # base + bass / mid / high gain
const SCOPE_JITTER_HIGH := 0.35
const SCOPE_JITTER_IMPULSE := 0.45
const SCOPE_TURN_RATE := 0.15
const SCOPE_TURN_STEP := 0.05
const SCOPE_TURN_ENERGY := 0.3
const SCOPE_TURN_IMPULSE := 0.7
const SCOPE_MAX_AMP := 1.7
const JITTER_X_FREQ := 27.0
const JITTER_X_PHASE := 9.0
const JITTER_Y_FREQ := 23.0
const JITTER_Y_PHASE := 11.0
const SCOPE_PASSES := [[Color(120.0 / 255.0, 195.0 / 255.0, 1.0, 0.5), 2.0], [Color(230.0 / 255.0, 248.0 / 255.0, 1.0, 0.92), 1.0]]
## web SETS: per trace, three sum-of-sines components [ax, ay, fx, fy, px, py].
const SCOPE_SETS := [
	[[0.82, 0.72, 3.0, 2.0, 0.2, 0.5], [0.42, 0.46, 7.0, 5.0, 1.1, 0.3], [0.2, 0.26, 11.0, 13.0, 2.0, 1.4]],
	[[0.7, 0.84, 2.0, 3.0, 1.0, 0.0], [0.46, 0.4, 5.0, 8.0, 0.4, 2.0], [0.22, 0.2, 14.0, 10.0, 0.7, 0.9]],
	[[0.76, 0.74, 4.0, 4.0, 0.6, 1.6], [0.34, 0.52, 9.0, 6.0, 1.5, 0.2], [0.18, 0.22, 12.0, 15.0, 0.3, 2.4]],
]
const BAR_COLOR := Color(120.0 / 255.0, 200.0 / 255.0, 1.0)
const BAR_HEIGHT := 0.72
const BAR_ALPHA := 0.22
const BAR_ALPHA_GAIN := 0.55
const BAR_INSET := 1.0
const RADIAL_COLOR := Color(130.0 / 255.0, 205.0 / 255.0, 1.0)
const RADIAL_INNER := 0.11
const RADIAL_REACH := 0.34
const RADIAL_TURN := 0.25
const RADIAL_WIDTH := 2.0
const RADIAL_ALPHA := 0.3
const RADIAL_ALPHA_GAIN := 0.55
const FIELD_COLOR := Color(140.0 / 255.0, 210.0 / 255.0, 1.0)
const FIELD_RADIUS := 0.6
const FIELD_RADIUS_BASS := 4.0
const FIELD_RADIUS_IMPULSE := 3.5
const FIELD_ALPHA := 0.22
const FIELD_ALPHA_GAIN := 0.5
const HALF := 0.5

var mode := RadioVizState.AUTO
var level_source := func() -> float: return 0.0
var bands_source := func() -> PackedFloat32Array: return PackedFloat32Array()

var state := RadioVizState.new()
var _active := false
var _pin := {}
var _viewport: SubViewport
var _canvas: Node2D
var _view: TextureRect

func _init() -> void:
	name = "RadioVisualizer"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_viewport = SubViewport.new()
	_viewport.transparent_bg = true
	_viewport.disable_3d = true
	_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_viewport)
	_canvas = Node2D.new()
	var lighter := ShaderMaterial.new()
	lighter.shader = LIGHTER_SHADER
	_canvas.material = lighter
	_canvas.draw.connect(_draw_frame)
	_viewport.add_child(_canvas)
	_view = TextureRect.new()
	_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_view.texture = _viewport.get_texture()
	var composite := ShaderMaterial.new()
	composite.shader = COMPOSITE_SHADER
	composite.set_shader_parameter("opacity", OPACITY)
	composite.set_shader_parameter("radius_px", CLIP_RADIUS)
	_view.material = composite
	add_child(_view)
	resized.connect(_resize)
	set_process(false)

## Godot turns _process on for a script that has one as it enters the tree: back to what the state says.
func _ready() -> void:
	_update_running()

## The radio on and the window shown: the canvas runs (web active); off, it clears.
func set_active(active: bool) -> void:
	_active = active
	_update_running()

func is_running() -> bool:
	return is_processing()

## A capture's frame (web __debugVizPin): seeded field, fixed bands, level, impulse, phase and frame.
func pin(values: Dictionary) -> void:
	_pin = values
	state = RadioVizState.pinned(values)
	_update_running()

func canvas_size() -> Vector2i:
	return _viewport.size

func _update_running() -> void:
	var running := _active or not _pin.is_empty()
	set_process(running)
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if running else SubViewport.UPDATE_ONCE
	_view.visible = running
	_canvas.queue_redraw()

func _process(_delta: float) -> void:
	if _pin.is_empty():
		state.step(bands_source.call(), level_source.call())
	else:
		state.pin(_pin)
	_canvas.queue_redraw()

## web: the canvas buffer follows the element's CSS size (it is scaled like any bitmap on a larger display).
func _resize() -> void:
	_viewport.size = Vector2i(maxi(1, roundi(size.x)), maxi(1, roundi(size.y)))
	_view.size = size
	(_view.material as ShaderMaterial).set_shader_parameter("box_px", size)

func _draw_frame() -> void:
	if not is_processing():
		return
	var shown := state.take_mode(mode)
	match shown:
		"scope":
			_draw_scope()
		"bars":
			_draw_bars()
		"radial":
			_draw_radial()
		_:
			_draw_field()

func _draw_scope() -> void:
	var box := Vector2(_viewport.size)
	var centre := box * HALF
	var punch := 1.0 + state.impulse * SCOPE_PUNCH
	var base := minf(box.x, box.y) * SCOPE_SIZE * (SCOPE_BASE + state.bass * SCOPE_BASS + state.level * SCOPE_LEVEL) * punch
	var drives := [state.bass, state.mid, state.high]
	var jitter := state.high * SCOPE_JITTER_HIGH + state.impulse * SCOPE_JITTER_IMPULSE
	for i in SCOPE_SETS.size():
		var group: Array = SCOPE_GROUPS[i]
		var turn := state.phase * (SCOPE_TURN_RATE + i * SCOPE_TURN_STEP) + i + state.energy * SCOPE_TURN_ENERGY \
			+ state.impulse * SCOPE_TURN_IMPULSE
		var amp := minf(SCOPE_MAX_AMP, (group[0] + drives[i] * group[1]) * punch)
		var points := _trace(SCOPE_SETS[i], centre, base, turn, amp, jitter)
		for pass_look: Array in SCOPE_PASSES:
			_canvas.draw_polyline(points, pass_look[0], pass_look[1], true)

func _trace(components: Array, centre: Vector2, radius: float, turn: float, amp: float, jitter: float) -> PackedVector2Array:
	var points := PackedVector2Array()
	points.resize(SEGMENTS + 1)
	var c := cos(turn)
	var s := sin(turn)
	for i in SEGMENTS + 1:
		var t := float(i) / SEGMENTS * FULL_TURN
		var x := 0.0
		var y := 0.0
		for part: Array in components:
			x += part[0] * sin(part[2] * t + part[4] + state.phase)
			y += part[1] * cos(part[3] * t + part[5] + state.phase)
		x += sin(t * JITTER_X_FREQ + state.phase * JITTER_X_PHASE) * jitter
		y += cos(t * JITTER_Y_FREQ + state.phase * JITTER_Y_PHASE) * jitter
		x *= amp
		y *= amp
		points[i] = centre + Vector2(x * c - y * s, x * s + y * c) * radius
	return points

func _draw_bars() -> void:
	var box := Vector2(_viewport.size)
	var width := box.x / RadioVizState.BANDS
	for i in RadioVizState.BANDS:
		var value := state.smooth[i]
		var height := value * box.y * BAR_HEIGHT
		_canvas.draw_rect(Rect2(i * width + BAR_INSET, (box.y - height) * HALF, width - 2.0 * BAR_INSET, height),
			Color(BAR_COLOR, BAR_ALPHA + value * BAR_ALPHA_GAIN))

func _draw_radial() -> void:
	var box := Vector2(_viewport.size)
	var inner := minf(box.x, box.y) * RADIAL_INNER
	var reach := minf(box.x, box.y) * RADIAL_REACH
	var turn := state.phase * RADIAL_TURN + state.impulse
	for i in RadioVizState.BANDS:
		var angle := float(i) / RadioVizState.BANDS * FULL_TURN + turn
		var direction := Vector2(cos(angle), sin(angle))
		var colour := Color(RADIAL_COLOR, RADIAL_ALPHA + state.smooth[i] * RADIAL_ALPHA_GAIN)
		var from := box * HALF + direction * inner
		var to := box * HALF + direction * (inner + state.smooth[i] * reach)
		_canvas.draw_line(from, to, colour, RADIAL_WIDTH, true)
		for cap in [from, to]:                     # lineCap: round
			_canvas.draw_circle(cap, RADIAL_WIDTH * HALF, colour, true, -1.0, true)

func _draw_field() -> void:
	var box := Vector2(_viewport.size)
	state.drift_field()
	var radius := FIELD_RADIUS + state.bass * FIELD_RADIUS_BASS + state.impulse * FIELD_RADIUS_IMPULSE
	var colour := Color(FIELD_COLOR, FIELD_ALPHA + state.high * FIELD_ALPHA_GAIN)
	for i in RadioVizState.FIELD_N:
		_canvas.draw_circle(Vector2(state.px[i] * box.x, state.py[i] * box.y), radius, colour, true, -1.0, true)
