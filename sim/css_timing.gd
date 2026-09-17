class_name CssTiming
## CSS animation timing: cubic-bezier timing functions, their presets and keyframe sampling (per-segment easing or
## steps(n, jump-end)), so web @keyframes can be replayed exactly. Values at a keyframe's time are returned exactly.

const EASE := [0.25, 0.1, 0.25, 1.0]          # CSS default animation-timing-function
const EASE_OUT := [0.0, 0.0, 0.58, 1.0]
const EASE_IN_OUT := [0.42, 0.0, 0.58, 1.0]
const BISECTION_STEPS := 30
const KEY_EPS := 1e-6                         # a fraction this close to a keyframe returns that keyframe's value

## cubic-bezier(x1, y1, x2, y2) evaluated at progress x (curve = [x1, y1, x2, y2]); x is solved by bisection.
static func cubic_bezier(x: float, curve: Array) -> float:
	var target := clampf(x, 0.0, 1.0)
	if target == 0.0 or target == 1.0:   # every cubic-bezier runs from (0, 0) to (1, 1): exact ends, no bisection residue
		return target
	var lo := 0.0
	var hi := 1.0
	var t := target
	for i in BISECTION_STEPS:
		t = (lo + hi) / 2.0
		if _bezier(t, curve[0], curve[2]) < target:
			lo = t
		else:
			hi = t
	return _bezier(t, curve[1], curve[3])

static func _bezier(t: float, p1: float, p2: float) -> float:
	var u := 1.0 - t
	return 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t

## Sample keyframes [[fraction, value], ...] (sorted, values float / Vector2 / Vector3) with `curve` in each segment.
static func sample(keys: Array, fraction: float, curve: Array) -> Variant:
	return _sample(keys, fraction, func(local: float) -> float: return cubic_bezier(local, curve))

## Sample keyframes with steps(n, jump-end) in each segment (the value moves in n jumps, holding each one).
static func sample_steps(keys: Array, fraction: float, steps: int) -> Variant:
	return _sample(keys, fraction, func(local: float) -> float: return floorf(local * steps) / steps)

## Progress through a looping animation: fraction of the current cycle, or -1 before `delay_s` (not started yet).
static func cycle_fraction(time_s: float, period_s: float, delay_s := 0.0) -> float:
	if time_s < delay_s:
		return -1.0
	return fposmod(time_s - delay_s, period_s) / period_s

static func _sample(keys: Array, fraction: float, timing: Callable) -> Variant:
	var f := clampf(fraction, 0.0, 1.0)
	for i in range(keys.size() - 1):
		var from: Array = keys[i]
		var to: Array = keys[i + 1]
		if absf(f - from[0]) <= KEY_EPS:
			return from[1]
		if absf(f - to[0]) <= KEY_EPS:
			return to[1]
		if f < to[0]:
			var local: float = (f - from[0]) / (to[0] - from[0])
			return lerp(from[1], to[1], timing.call(local))
	return keys[keys.size() - 1][1]
