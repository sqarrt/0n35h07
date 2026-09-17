class_name PointerLock extends RefCounted
## The browser pointer lock as Godot's captured mouse: the pause menu reads it, RESUME takes it back, Esc and a lost
## window focus release it.

func is_locked() -> bool:
	return Input.mouse_mode == Input.MOUSE_MODE_CAPTURED

func lock() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func release() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
