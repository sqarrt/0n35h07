class_name HudThrottle extends RefCounted
## web Match.syncHud throttle: HUD progress values are pushed at most when more than 50 ms passed since the last push
## (`now - lastHud > 50`); the very first frame pushes at once.

const INTERVAL_MS := 50.0

var _since_push_ms := INF

## Advance by `dt_ms`; true when the HUD should take fresh values this frame.
func tick(dt_ms: float) -> bool:
	_since_push_ms += dt_ms
	if _since_push_ms > INTERVAL_MS:
		_since_push_ms = 0.0
		return true
	return false
