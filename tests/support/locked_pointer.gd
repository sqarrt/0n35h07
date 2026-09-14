extends PointerLock
## Test double: a pointer lock the test holds or drops (headless Godot always reports a visible mouse).

var locked := true

func is_locked() -> bool:
	return locked

func lock() -> void:
	locked = true

func release() -> void:
	locked = false
