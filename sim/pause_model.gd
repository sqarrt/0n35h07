class_name PauseModel extends RefCounted
## Pause state — port of the web App rules: a live match without the pointer lock is a pause (nothing stops the
## match), and losing the lock starts the RESUME cooldown, because Chrome refuses a repeat requestPointerLock for a while.

const COOLDOWN_MS := 1300.0              # web POINTERLOCK_COOLDOWN

var _locked := false
var _ready_at_ms := 0.0

## The pointer lock as last seen; only a change counts (web pointerlockchange).
func set_locked(locked: bool, now_ms: float) -> void:
	if locked == _locked:
		return
	_locked = locked
	if not locked:
		_ready_at_ms = now_ms + COOLDOWN_MS

func is_locked() -> bool:
	return _locked

func is_paused(live: bool) -> bool:
	return live and not _locked

func cooldown_left_ms(now_ms: float) -> float:
	return maxf(0.0, _ready_at_ms - now_ms)

func can_resume(now_ms: float) -> bool:
	return cooldown_left_ms(now_ms) <= 0.0

## How much of the cooldown has passed, 0..1 (web cooldownPct / 100).
func cooldown_share(now_ms: float) -> float:
	return 1.0 - cooldown_left_ms(now_ms) / COOLDOWN_MS
