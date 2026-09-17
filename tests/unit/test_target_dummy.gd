extends GutTest

const DUMMY := preload("res://scenes/target_dummy.tscn")

func test_dummy_hitbox_is_raycastable_and_flashes() -> void:
	var d: TargetDummy = DUMMY.instantiate()
	d.entity_id = 5
	d.position = Vector3(0, 0, -5)
	add_child_autofree(d)
	await get_tree().physics_frame
	var rc := WorldRaycaster.new(get_tree().root.world_3d.direct_space_state)
	var hit = rc.raycast(Vector3(0, 1, 0), Vector3(0, 0, -1), [], false)
	assert_not_null(hit, "dummy hitbox is hit")
	assert_eq(hit.entity_id, 5)
	assert_false(d.is_flashing(), "not flashing before a hit")
	d.on_hit()
	assert_true(d.is_flashing(), "flashing after a hit")
