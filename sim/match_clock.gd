class_name MatchClock extends RefCounted
## Match time limit — port of web Match.tickMatchClock. The clock starts on the first live tick and runs
## down to zero; a zero duration means no time limit (web backward compatibility).
## Web measures wall-clock time; Godot accumulates the fixed physics dt (deterministic, same result).

const MS_PER_S := 1000.0

var _duration_ms: float
var _elapsed_ms := 0.0

func _init(duration_ms: float) -> void:
	_duration_ms = maxf(0.0, duration_ms)

func has_timer() -> bool:
	return _duration_ms > 0.0

## Advance by one tick; only live time counts.
func update(dt: float, live: bool) -> void:
	if live and has_timer():
		_elapsed_ms = minf(_duration_ms, _elapsed_ms + dt * MS_PER_S)

func remaining_ms() -> float:
	return maxf(0.0, _duration_ms - _elapsed_ms)

## Whole seconds for the HUD, rounded up (web Math.ceil(remaining / 1000)).
func seconds_left() -> int:
	return int(ceil(remaining_ms() / MS_PER_S))

func is_over() -> bool:
	return has_timer() and remaining_ms() <= 0.0
