extends GutTest
## Two balls standing inside each other push apart instead of sharing the spot (web Match.maybeKnockback through the
## real movement). Headless physics.

const PLAYER := preload("res://scenes/player.tscn")
const OVERLAP := 0.3                  # centres this close are well inside the two-radius sphere overlap
const PUSH_FRAMES := 30               # longer than KNOCKBACK_DURATION_MS

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

func test_overlapping_players_push_each_other_out() -> void:
	var arena := Node3D.new()
	add_child_autofree(arena)
	_floor(arena)
	var one := _entity(arena, 0, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	var two := _entity(arena, 1, Vector3(OVERLAP, MoveConst.EYE_HEIGHT, 0))
	var m := MatchNode.new()
	arena.add_child(m)
	m.add_entity(one, 0)
	m.add_entity(two, 1)
	m.force_live()
	for i in range(PUSH_FRAMES):
		await get_tree().physics_frame
	var apart := one.global_position.distance_to(two.global_position)
	assert_gt(apart, KnockbackRule.OVERLAP_DIST,
		"the balls were pushed out of each other instead of sharing the spot")
	assert_false(one.player.body.is_knocking(), "and the push is a burst, not a constant force")
