extends GutTest

func test_builds_geo_geometry_and_colliders() -> void:
	var m := GeoLoader.build("res://maps/os_india.json", "res://maps/os_india_geo.json")
	var meshes := m.find_children("*", "MeshInstance3D", true, false)
	assert_gt(meshes.size(), 1, "render meshes built from geo chunks (vertex-coloured)")
	var world := false
	for b in m.find_children("*", "StaticBody3D", true, false):
		if b.collision_layer == CombatConst.LAYER_WORLD_BIT:
			world = true
	assert_true(world, "a beam-blocking collider on the world layer")
	m.free()

func test_geo_mesh_has_vertices() -> void:
	var m := GeoLoader.build("res://maps/os_arena.json", "res://maps/os_arena_geo.json")
	var mi: MeshInstance3D = m.find_children("*", "MeshInstance3D", true, false)[1]  # [0] is the floor
	assert_gt(mi.mesh.get_surface_count(), 0, "geo mesh has a surface")
	m.free()
