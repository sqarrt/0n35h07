extends GutTest
## Map geometry parity with web Arena.tsx: movement collides with geo.collider + floor + invisible bounds;
## the beam hits only the raycast render groups (floor and blocksBeam:false walls let it through).

const ARENA_RAW := "res://maps/os_arena.json"
const ARENA_GEO := "res://maps/os_arena_geo.json"
const INDIA_RAW := "res://maps/os_india.json"
const INDIA_GEO := "res://maps/os_india_geo.json"
const BOUND_COUNT := 4
const PROBE_HEIGHT := 1.0   # side ray height: above the floor, below the 3 m perimeter walls
const PROBE_DROP := 5.0     # vertical ray half-length around the floor plane

func _bodies_on(m: Node, layer: int) -> Array:
	return m.find_children("*", "StaticBody3D", true, false).filter(func(b): return b.collision_layer == layer)

func _trimesh_vertex_count(bodies: Array) -> int:
	var n := 0
	for b in bodies:
		for cs in b.get_children():
			if cs is CollisionShape3D and cs.shape is ConcavePolygonShape3D:
				n += cs.shape.get_faces().size()
	return n

func test_geo_mesh_has_vertices() -> void:
	var m := GeoLoader.build(ARENA_RAW, ARENA_GEO)
	var meshes := m.find_children("*", "MeshInstance3D", true, false)
	assert_gt(meshes.size(), 1, "render meshes built from geo chunks (vertex-coloured)")
	m.free()

func test_movement_trimesh_is_the_geo_collider() -> void:
	var m := GeoLoader.build(ARENA_RAW, ARENA_GEO)
	var geo: Dictionary = MapFiles.read_json(ARENA_GEO)
	var expected: int = Marshalls.base64_to_raw(geo["collider"]["position"]).to_float32_array().size() / 3
	assert_eq(_trimesh_vertex_count(_bodies_on(m, CombatConst.LAYER_WORLD_NOBEAM_BIT)), expected,
		"movement trimesh comes from geo.collider, not from render chunks")
	assert_eq(_bodies_on(m, CombatConst.LAYER_WORLD_BIT).size(), 0, "no map body is both solid and beam-blocking")
	m.free()

func test_beam_targets_are_not_solid() -> void:
	var m := GeoLoader.build(INDIA_RAW, INDIA_GEO)
	assert_gt(_bodies_on(m, CombatConst.LAYER_BEAM_ONLY_BIT).size(), 0, "raycast render groups become beam targets")
	assert_eq(CombatConst.MOVE_MASK & CombatConst.LAYER_BEAM_ONLY_BIT, 0, "beam targets never block movement")
	assert_ne(CombatConst.COMBAT_RAY_MASK & CombatConst.LAYER_BEAM_ONLY_BIT, 0, "the beam hits them")
	m.free()

func test_invisible_bounds_enclose_the_arena() -> void:
	var m := GeoLoader.build(ARENA_RAW, ARENA_GEO)
	var bounds := m.find_children("Bound*", "StaticBody3D", true, false)
	assert_eq(bounds.size(), BOUND_COUNT, "four invisible perimeter walls")
	for b in bounds:
		assert_eq(b.collision_layer, CombatConst.LAYER_WORLD_NOBEAM_BIT, "bounds stop movement only")
	m.free()

func test_beam_passes_floor_and_perimeter_but_movement_does_not() -> void:
	var m := GeoLoader.build(ARENA_RAW, ARENA_GEO)
	add_child_autofree(m)
	await get_tree().physics_frame
	var space := m.get_world_3d().direct_space_state
	var down := PhysicsRayQueryParameters3D.create(Vector3(0, PROBE_DROP, 0), Vector3(0, -PROBE_DROP, 0))
	down.collision_mask = CombatConst.COMBAT_RAY_MASK
	assert_true(space.intersect_ray(down).is_empty(), "the beam ignores the floor (web noRaycast)")
	down.collision_mask = CombatConst.MOVE_MASK
	assert_false(space.intersect_ray(down).is_empty(), "movement stands on the floor")
	var side := PhysicsRayQueryParameters3D.create(Vector3(0, PROBE_HEIGHT, 0), Vector3(CombatConst.AIM_RANGE, PROBE_HEIGHT, 0))
	side.collision_mask = CombatConst.COMBAT_RAY_MASK
	assert_true(space.intersect_ray(side).is_empty(), "Arena perimeter walls are blocksBeam:false")
	side.collision_mask = CombatConst.MOVE_MASK
	assert_false(space.intersect_ray(side).is_empty(), "movement stops at the perimeter")
