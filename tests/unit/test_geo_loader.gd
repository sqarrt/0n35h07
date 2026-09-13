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

const MIN_FRONT_SHARE := 0.99   # tolerate degenerate slivers
const RENDER_GROUPS := ["opaqueRaycast", "opaqueNoRaycast", "transparentRaycast", "transparentNoRaycast"]

## Share of triangles whose vertex order is clockwise relative to their normal (Godot's front-face convention).
func _clockwise_share(verts: PackedVector3Array, normals: PackedVector3Array) -> float:
	var clockwise := 0
	var counted := 0
	for i in range(0, verts.size() - 2, 3):
		var side := (verts[i + 1] - verts[i]).cross(verts[i + 2] - verts[i]).dot(normals[i])
		if is_zero_approx(side):
			continue
		counted += 1
		if side < 0.0:
			clockwise += 1
	return float(clockwise) / maxi(counted, 1)

func test_render_triangles_are_reversed_to_godot_front_faces() -> void:
	var geo := MapFiles.read_json(ARENA_GEO)
	var group = null
	for key in RENDER_GROUPS:
		if group == null:
			group = geo["chunks"][0].get(key)
	var source_share := _clockwise_share(GeoLoader._verts(group["position"]), GeoLoader._verts(group["normal"]))
	assert_lt(source_share, 1.0 - MIN_FRONT_SHARE, "geo.json comes from three.js: counter-clockwise front faces")
	var m := GeoLoader.build(ARENA_RAW, ARENA_GEO)
	var meshes := m.get_children().filter(func(n): return n is MeshInstance3D and n.name != "FloorGrid")
	var arrays: Array = (meshes[0] as MeshInstance3D).mesh.surface_get_arrays(0)
	assert_gt(_clockwise_share(arrays[Mesh.ARRAY_VERTEX], arrays[Mesh.ARRAY_NORMAL]), MIN_FRONT_SHARE,
		"Godot treats clockwise as front: otherwise back faces render and walls are lit from the wrong side")
	m.free()

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
