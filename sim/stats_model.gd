class_name StatsModel extends RefCounted
## Frame-time and speed readout — port of the web components/StatsOverlay.tsx logic: a 150-frame frame-time history
## (one graph pixel each, oldest to newest), FPS and the worst frame of each 500 ms window, and the web text formats.
## The words are the web English strings until the interface gets its translations.

const HISTORY := 150                     # web HISTORY = GRAPH_W: one point per pixel of width
const WINDOW_MS := 500.0                 # web FPS_WINDOW_MS
const MS_PER_S := 1000.0
const GRAPH_W := 150.0
const GRAPH_H := 46.0
const MS_TOP := 33.3                     # graph top = 33.3 ms (30 FPS)
const MS_120 := 1000.0 / 120.0           # 120 FPS frame budget guide
const MS_60 := 1000.0 / 60.0             # 60 FPS frame budget guide
const MIN_LABEL := "MIN"                 # web en statsMin
const MS_LABEL := "ms"                   # web en statsMs
const SPEED_UNIT := "u/s"                # web en statsSpeedUnit
const DECIMAL := 10.0
const HALF := 0.5

var fps := 0
var worst_ms := 0.0

var _history := PackedFloat32Array()
var _head := 0
var _frames := 0
var _window_ms := 0.0
var _window_max := 0.0

func _init() -> void:
	_history.resize(HISTORY)

## One rendered frame (web: the time between two requestAnimationFrame callbacks).
func push_frame(frame_ms: float) -> void:
	_history[_head] = frame_ms
	_head = (_head + 1) % HISTORY
	_window_max = maxf(_window_max, frame_ms)
	_frames += 1
	_window_ms += frame_ms
	if _window_ms >= WINDOW_MS:
		fps = roundi(_frames * MS_PER_S / _window_ms)
		worst_ms = _window_max
		_frames = 0
		_window_ms = 0.0
		_window_max = 0.0

## Parity fixture: frozen readings (web __debugStats), frame times oldest to newest.
func set_fixed(fixed_fps: int, fixed_worst_ms: float, frame_times: PackedFloat32Array) -> void:
	fps = fixed_fps
	worst_ms = fixed_worst_ms
	for i in HISTORY:
		_history[i] = frame_times[i] if i < frame_times.size() else 0.0
	_head = 0

## The frame times oldest to newest.
func history() -> PackedFloat32Array:
	var out := PackedFloat32Array()
	out.resize(HISTORY)
	for i in HISTORY:
		out[i] = _history[(_head + i) % HISTORY]
	return out

## The slowest frame of the window as FPS (0 before the first window).
func worst_fps() -> int:
	return roundi(MS_PER_S / worst_ms) if worst_ms > 0.0 else 0

## Graph height of a frame time: 0 ms at the bottom, MS_TOP and slower at the top.
static func graph_y(frame_ms: float) -> float:
	return GRAPH_H - minf(frame_ms, MS_TOP) / MS_TOP * GRAPH_H

func fps_text() -> String:
	return "%d FPS · %s %d (%s %s)" % [fps, MIN_LABEL, worst_fps(), to_fixed_1(worst_ms), MS_LABEL]

static func speed_text(speed: float) -> String:
	return "%s %s" % [to_fixed_1(speed), SPEED_UNIT]

## JS Number.toFixed(1): the nearest tenth, an exact tie going to the larger value (printf would round it to even).
static func to_fixed_1(value: float) -> String:
	var tenths := floori(absf(value) * DECIMAL + HALF)
	return "%s%d.%d" % ["-" if value < 0.0 and tenths > 0 else "", tenths / int(DECIMAL), tenths % int(DECIMAL)]
