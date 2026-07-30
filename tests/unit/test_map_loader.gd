extends GutTest

func test_builds_os_pillars_geometry() -> void:
	var m := MapLoader.build("res://maps/os_pillars.json")
	add_child_autofree(m)
	assert_gt(m.get_child_count(), 100, "floor + many box blocks built")
	var floor_body: Node3D = m.get_child(0)
	assert_lt(floor_body.position.y, 0.0, "floor sits below the origin")
	assert_eq(floor_body.collision_layer, CombatConst.LAYER_WORLD_BIT, "floor is a beam-blocking wall")

func test_map_floor_is_raycastable() -> void:
	var m := MapLoader.build("res://maps/os_pillars.json")
	add_child_autofree(m)
	await get_tree().physics_frame
	var rc := WorldRaycaster.new(get_tree().root.world_3d.direct_space_state)
	var hit = rc.raycast(Vector3(0, 40, 0), Vector3(0, -1, 0), [], false)
	assert_not_null(hit, "a downward ray hits the map floor")
	assert_eq(hit.entity_id, -1, "the floor is world geometry, not an entity")
