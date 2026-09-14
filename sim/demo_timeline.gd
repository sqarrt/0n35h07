class_name DemoTimeline extends RefCounted
## The replay clock over a clip's fragments — port of web DemoScene useFrame: at the clock, the frame and the next one
## with the blend between them, the frames whose events have come due, jump cuts from one fragment to the next (a cut
## asks the caller to reseed its sound flags), the lead signal just before the last fragment ends, and the end.

const NEAR_END_LEAD_MS := 60.0                 # web NEAR_END_LEAD_MS
const MAX_STEP_S := 0.05                       # web: dt clamped to 50 ms
const MS_PER_S := 1000.0

var range_index := 0
var clock_ms := 0.0
var ended := false

var _clip: DemoClip
var _ranges: Array                             # [[from, to], ...] inclusive frame indices
var _fired_to := 0
var _near_end_fired := false

func _init(clip: DemoClip, ranges: Array) -> void:
	_clip = clip
	_ranges = ranges
	_start_range(0)

## The first frame of the current fragment (players are placed on it before the first step).
func first_frame() -> int:
	return _ranges[range_index][0]

## Advance the clock; returns the step: "frame", "next", "blend" (0..1), "events" (frame indices whose events fire now,
## in order), "cut" (a new fragment started after this step), "near_end" and "ended".
func step(dt_s: float) -> Dictionary:
	var out := {"frame": first_frame(), "next": first_frame(), "blend": 0.0, "events": [], "cut": false,
		"near_end": false, "ended": ended}
	if ended:
		return out
	clock_ms += minf(dt_s, MAX_STEP_S) * MS_PER_S
	var from: int = _ranges[range_index][0]
	var to: int = _ranges[range_index][1]
	var i := from
	while i < to and _clip.time_ms(i + 1) <= clock_ms:
		i += 1
	var next := mini(i + 1, to)
	var span := maxf(1.0, _clip.time_ms(next) - _clip.time_ms(i))
	out["frame"] = i
	out["next"] = next
	out["blend"] = clampf((clock_ms - _clip.time_ms(i)) / span, 0.0, 1.0)
	while _fired_to < i:
		_fired_to += 1
		out["events"].append(_fired_to)
	if not _near_end_fired and range_index == _ranges.size() - 1 and clock_ms >= _clip.time_ms(to) - NEAR_END_LEAD_MS:
		_near_end_fired = true
		out["near_end"] = true
	if clock_ms >= _clip.time_ms(to):
		if range_index < _ranges.size() - 1:
			_start_range(range_index + 1)
			out["cut"] = true
		else:
			ended = true
			out["ended"] = true
	return out

func _start_range(index: int) -> void:
	range_index = index
	clock_ms = _clip.time_ms(_ranges[index][0])
	_fired_to = _ranges[index][0] - 1
