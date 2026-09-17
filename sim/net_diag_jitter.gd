class_name NetDiagJitter extends RefCounted
## Under `--netdiag`: how steadily a remote ball actually arrives on this screen. Every placement of a remote player is
## one sample — how long since the previous one, and how far the ball moved — and every couple of seconds the window
## writes the spread to its log. Even gaps with even steps mean the ball glides; gaps that alternate between nothing
## and double, or steps that stall and turn back, mean it shakes — and the numbers say which of the two it is.

const REPORT_S := 2.0
const MS_PER_S := 1000.0
const STALE_STEP := 1e-4               # a step shorter than this moved the ball nowhere

var _last := {}                        # id -> {"t": ms, "pos": Vector3, "dir": Vector3}
var _stat := {}                        # id -> the window's counters
var _since := 0.0

## One placement of remote `id` at `pos`, computed on the clock reading `now_ms`.
func sample(id: int, now_ms: float, pos: Vector3) -> void:
	var prev = _last.get(id)
	var dir := Vector3.ZERO
	if prev != null:
		var step: Vector3 = pos - (prev["pos"] as Vector3)
		var length := step.length()
		dir = step.normalized() if length > STALE_STEP else (prev["dir"] as Vector3)
		var s: Dictionary = _stat.get(id, _fresh())
		var gap := now_ms - float(prev["t"])
		s["gaps"].append(gap)
		s["steps"].append(length)
		if gap > 0.0:
			s["speeds"].append(length / gap * MS_PER_S)   # what the eye reads: a steady speed is a gliding ball
		if length <= STALE_STEP:
			s["stale"] = int(s["stale"]) + 1
		elif (prev["dir"] as Vector3) != Vector3.ZERO and dir.dot(prev["dir"]) < 0.0:
			s["back"] = int(s["back"]) + 1     # the ball went back the way it came: that is the shake
		_stat[id] = s
	_last[id] = {"t": now_ms, "pos": pos, "dir": dir}

## Advances the report clock; writes one line per remote every REPORT_S and starts a fresh window.
func step(delta: float) -> void:
	_since += delta
	if _since < REPORT_S:
		return
	_since = 0.0
	for id in _stat:
		var s: Dictionary = _stat[id]
		if s["gaps"].is_empty():
			continue
		GameLog.log("netdiag", "jitter", {
			"id": id, "n": s["gaps"].size(),
			"gap_ms": _spread(s["gaps"]), "step": _spread(s["steps"]), "speed": _spread(s["speeds"]),
			"stale": s["stale"], "back": s["back"],
		})
	_stat.clear()

## "min/avg/max" of a window's numbers, rounded to thousandths so the line stays readable.
func _spread(values: PackedFloat32Array) -> String:
	if values.is_empty():
		return "-"
	var total := 0.0
	var low := INF
	var high := -INF
	for v in values:
		total += v
		low = minf(low, v)
		high = maxf(high, v)
	return "%.3f/%.3f/%.3f" % [low, total / values.size(), high]

func _fresh() -> Dictionary:
	return {"gaps": PackedFloat32Array(), "steps": PackedFloat32Array(), "speeds": PackedFloat32Array(),
		"stale": 0, "back": 0}
