extends GutTest
## A real fire through the match: a kill scores and the victim ghost-respawns. Headless physics.

const PLAYER := preload("res://scenes/player.tscn")

func _floor(arena: Node3D) -> void:
	var sb := StaticBody3D.new()
	sb.collision_layer = CombatConst.LAYER_WORLD_BIT
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new(); b.size = Vector3(80, 1, 80)
	cs.shape = b; cs.position = Vector3(0, -0.5, 0)
	sb.add_child(cs); arena.add_child(sb)

func _entity(arena: Node3D, id: int, pos: Vector3) -> PlayerNode:
	var p: PlayerNode = PLAYER.instantiate()
	p.player.id = id
	p.player.body.position = pos
	p.get_node("Camera3D").free()
	arena.add_child(p)
	return p

func test_kill_scores_and_victim_respawns() -> void:
	var arena := Node3D.new()
	add_child_autofree(arena)
	_floor(arena)
	var victim := _entity(arena, 0, Vector3(0, MoveConst.EYE_HEIGHT, -6))
	var shooter := _entity(arena, 1, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	var m := MatchNode.new()
	arena.add_child(m)
	m.add_entity(victim, 0)    # team 0
	m.add_entity(shooter, 1)   # team 1 -> enemies
	m.force_live()             # skip the entry countdown for the test
	await get_tree().physics_frame
	shooter.player.aim(Vector3(0, MoveConst.EYE_HEIGHT, -6), Vector3(0, MoveConst.EYE_HEIGHT, 0))
	shooter.player.start_firing()
	var killed := false
	for i in range(60):
		await get_tree().physics_frame
		if victim.player.respawning:
			killed = true
			break
	assert_true(killed, "the beam killed the victim (ghost phase)")
	assert_eq(m.score_of(1), 1, "shooter scored the kill")
	for i in range(130):   # > RESPAWN_GHOST_MS
		await get_tree().physics_frame
	assert_true(victim.player.alive, "victim materialized after the ghost phase")
