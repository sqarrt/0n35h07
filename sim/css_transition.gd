class_name CssTransition extends RefCounted
## A CSS `transition: <property> <duration> <timing>`: a new target starts a fresh transition from the current value;
## setting the same target again changes nothing. The timing is linear, or a cubic-bezier curve ([x1, y1, x2, y2]).

var duration_s: float
var value := 0.0
var _curve: Array
var _from := 0.0
var _to := 0.0
var _elapsed_s := 0.0

func _init(duration: float, curve := []) -> void:
	duration_s = duration
	_curve = curve

func set_target(target: float) -> void:
	if is_equal_approx(target, _to):
		return
	_from = value
	_to = target
	_elapsed_s = 0.0

## Jump straight to `target` (an element that unmounts / mounts without animating).
func snap(target: float) -> void:
	_from = target
	_to = target
	value = target
	_elapsed_s = duration_s

func advance(dt: float) -> void:
	_elapsed_s += dt
	if duration_s <= 0.0:
		value = _to
		return
	var progress := minf(_elapsed_s / duration_s, 1.0)
	value = lerpf(_from, _to, CssTiming.cubic_bezier(progress, _curve) if not _curve.is_empty() else progress)

func target() -> float:
	return _to
