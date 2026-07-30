extends GutTest
## Verifies dynamic FOV (movement widens, windup narrows). Simulates input via Input.action_*.

const PLAYER := preload("res://scenes/player.tscn")

func _rig() -> Array:
	var p: PlayerNode = PLAYER.instantiate()
	add_child_autofree(p)
	var cam: Camera3D = p.get_node("Camera3D")
	var hc := HumanController.new()
	add_child_autofree(hc)
	hc.setup(p, cam)
	return [p, cam]

func after_each() -> void:
	Input.action_release("move_fwd")

func test_fov_widens_when_moving() -> void:
	var rig := _rig()
	var cam: Camera3D = rig[1]
	Input.action_press("move_fwd")
	for i in range(40):
		await get_tree().process_frame
	Input.action_release("move_fwd")
	assert_gt(cam.fov, 80.0, "FOV widens toward FOV_MOVING while moving")

func test_fov_narrows_during_windup() -> void:
	var rig := _rig()
	var p: PlayerNode = rig[0]
	var cam: Camera3D = rig[1]
	p.player.start_firing()   # weapon is set in PlayerNode._ready
	var min_fov := 999.0
	for i in range(20):       # capture the dip while the charge is still active
		await get_tree().process_frame
		min_fov = minf(min_fov, cam.fov)
	assert_lt(min_fov, 74.0, "FOV narrows toward FOV_WINDUP while charging")
