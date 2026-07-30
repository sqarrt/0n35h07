extends GutTest
## Godot physics combat raycast, headless.

func _wall(at: Vector3, size: Vector3, layer: int) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = layer
	sb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	sb.add_child(cs)
	sb.position = at
	return sb

func _hitbox(at: Vector3, eid: int) -> Hitbox:
	var hb := Hitbox.new()   # has the entity_id property + presets the hitbox layer in _ready
	hb.entity_id = eid
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(1, 2, 1)
	cs.shape = box
	hb.add_child(cs)
	hb.position = at
	return hb

func _space() -> PhysicsDirectSpaceState3D:
	return get_tree().root.world_3d.direct_space_state

func test_ray_hits_hitbox_and_reads_entity_id() -> void:
	var box := _hitbox(Vector3(0, 1, -5), 42)
	add_child_autofree(box)
	await get_tree().physics_frame
	var rc := WorldRaycaster.new(_space())
	var hit = rc.raycast(Vector3(0, 1, 0), Vector3(0, 0, -1), [], false)
	assert_not_null(hit, "ray should hit the hitbox")
	assert_eq(hit.entity_id, 42)

func test_wall_blocks_before_hitbox() -> void:
	var wall := _wall(Vector3(0, 1, -3), Vector3(4, 4, 1), CombatConst.LAYER_WORLD_BIT)
	var box := _hitbox(Vector3(0, 1, -6), 42)
	add_child_autofree(wall)
	add_child_autofree(box)
	await get_tree().physics_frame
	var rc := WorldRaycaster.new(_space())
	var hit = rc.raycast(Vector3(0, 1, 0), Vector3(0, 0, -1), [], false)
	assert_not_null(hit)
	assert_eq(hit.entity_id, -1, "wall (nearest) blocks -> no entity")

func test_clean_miss_returns_null() -> void:
	var rc := WorldRaycaster.new(_space())
	var hit = rc.raycast(Vector3(0, 50, 0), Vector3(0, 1, 0), [], false)
	assert_null(hit)
