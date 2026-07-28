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
