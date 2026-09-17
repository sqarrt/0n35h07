class_name PauseModel extends RefCounted
## Pause state — port of the web App rules: a live match without the pointer lock is a pause (nothing stops the match).
## Web also made RESUME wait out a cooldown, because Chrome refuses a repeat requestPointerLock for about a second;
## Godot takes the mouse back at once, so that wait is gone with the browser that forced it.

var _locked := false

## The pointer lock as last seen; only a change counts (web pointerlockchange).
func set_locked(locked: bool) -> void:
	_locked = locked

func is_locked() -> bool:
	return _locked

func is_paused(live: bool) -> bool:
	return live and not _locked
