extends GutTest
## In-engine movement — runs the real physics server headless.
## Uses player.tscn (which carries the capsule collider); a bare PlayerNode has no shape.

const PLAYER := preload("res://scenes/player.tscn")

func _floor() -> StaticBody3D:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(40, 1, 40)
	cs.shape = box
	cs.position = Vector3(0, -0.5, 0)  # top surface at y=0
	sb.add_child(cs)
	return sb

func _spawn(arena: Node3D, at: Vector3) -> PlayerNode:
	var p: PlayerNode = PLAYER.instantiate()
	p.player.body.position = at
	arena.add_child(p)   # arena is already in the tree -> _ready runs, sets global_position from body.position
	return p

func _ledge(at: Vector3, size: Vector3) -> StaticBody3D:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	sb.add_child(cs)
	sb.position = at
	return sb

func test_player_falls_and_rests_at_eye_height() -> void:
	var arena := Node3D.new()
	arena.add_child(_floor())
	add_child_autofree(arena)
	var p := _spawn(arena, Vector3(0, 5, 0))
	for i in range(180):  # 3 s
		await get_tree().physics_frame
	assert_almost_eq(p.global_position.y, MoveConst.EYE_HEIGHT, 0.15,
		"comes to rest with eyes at EYE_HEIGHT above the floor")

func test_player_walks_forward_on_ground() -> void:
	var arena := Node3D.new()
	arena.add_child(_floor())
	add_child_autofree(arena)
	var p := _spawn(arena, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	for i in range(30):  # settle
		await get_tree().physics_frame
	var z0 := p.global_position.z
	for i in range(60):  # 1 s of forward input
		p.player.move_intent(Vector3(0, 0, -MoveConst.MOVE_SPEED))
		await get_tree().physics_frame
	assert_lt(p.global_position.z, z0 - 3.0, "moved forward (-Z) a few metres")

func test_player_steps_up_low_ledge() -> void:
	var arena := Node3D.new()
	arena.add_child(_floor())
	# 0.8 m ledge (< AUTOSTEP_MAX_HEIGHT), deep in -Z so the player stays on top after climbing
	arena.add_child(_ledge(Vector3(0, 0.4, -17), Vector3(8, 0.8, 30)))
	add_child_autofree(arena)
	var p := _spawn(arena, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	for i in range(30):  # settle
		await get_tree().physics_frame
	for i in range(90):  # walk forward into the ledge
		p.player.move_intent(Vector3(0, 0, -MoveConst.MOVE_SPEED))
		await get_tree().physics_frame
	assert_gt(p.global_position.y, MoveConst.EYE_HEIGHT + 0.5,
		"stepped up onto the 0.8 m ledge (eyes rise by ~0.8)")

func test_player_jumps_onto_2m_block() -> void:
	# Web parity: a single jump (apex ~1.45) + airborne autostep (1.05) lands you on a 2m block.
	var arena := Node3D.new()
	arena.add_child(_floor())
	arena.add_child(_ledge(Vector3(0, 1.0, -18), Vector3(8, 2.0, 30)))  # top at y=2
	add_child_autofree(arena)
	var p := _spawn(arena, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	for i in range(30):  # settle
		await get_tree().physics_frame
	for i in range(150):  # walk forward while holding jump (bhop) into the block
		p.player.move_intent(Vector3(0, 0, -MoveConst.MOVE_SPEED))
		p.player.set_jump_input(true)
		await get_tree().physics_frame
	assert_gt(p.global_position.y, MoveConst.EYE_HEIGHT + 1.5,
		"jump + airborne autostep lands the player on top of the 2 m block")

