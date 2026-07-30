class_name Player extends RefCounted
## Composes a Body and exposes intent methods (the same surface a bot will drive later).
## 2a slice: movement only — no weapon/shield/respawn yet. Ported from web Player.ts (trimmed).

var body := Body.new()
var frozen := false
var _look_dir := Vector3(0, 0, -1)

func can_move() -> bool:
	return not frozen

func can_act() -> bool:
	return not frozen

func move_intent(dir: Vector3) -> void:
	if not can_move():
		return
	body.move(dir)

func set_jump_input(held: bool) -> void:
	body.set_jump_input(can_move() and held)

func set_look(dir: Vector3) -> void:
	if dir.length_squared() > 1e-8:
		_look_dir = dir

func dash(dir: Vector3) -> bool:
	if not can_act():
		return false
	if dir.length_squared() == 0.0:
		return false
	return body.dash(dir)

func set_frozen(v: bool) -> void:
	frozen = v
	if v:
		body.halt()

func look_dir() -> Vector3:
	return _look_dir
