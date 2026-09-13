class_name CssTransition extends RefCounted
## A CSS `transition: <property> <duration> linear`: a new target starts a fresh transition from the current value;
## setting the same target again changes nothing.

var duration_s: float
var value := 0.0
var _from := 0.0
var _to := 0.0
var _elapsed_s := 0.0

func _init(duration: float) -> void:
	duration_s = duration

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
	value = lerpf(_from, _to, minf(_elapsed_s / duration_s, 1.0)) if duration_s > 0.0 else _to

func target() -> float:
	return _to
