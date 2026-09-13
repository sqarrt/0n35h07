extends GutTest
## Floor grid parity with web grid.ts: 1 m cells over the whole arena at y = 0.01, lines on whole multiples.

const HX := 20.0
const HZ := 10.0

func test_lines_cover_the_arena_on_whole_units() -> void:
	var grid := FloorGrid.build(HX, HZ)
	var verts: PackedVector3Array = grid.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var along_z := int(2.0 * HX / FloorGrid.STEP) + 1
	var along_x := int(2.0 * HZ / FloorGrid.STEP) + 1
	assert_eq(verts.size(), 2 * (along_z + along_x), "two vertices per line")
	assert_eq(verts[0], Vector3(-HX, FloorGrid.GRID_Y, -HZ), "web order: lines along Z first")
	assert_eq(verts[1], Vector3(-HX, FloorGrid.GRID_Y, HZ))
	grid.free()

func test_grid_is_unlit_and_never_collides() -> void:
	var grid := FloorGrid.build(HX, HZ)
	var mat := grid.material_override as StandardMaterial3D
	assert_eq(mat.shading_mode, BaseMaterial3D.SHADING_MODE_UNSHADED, "web lineBasicMaterial")
	assert_eq(mat.albedo_color, FloorGrid.COLOR)
	assert_eq(grid.find_children("*", "CollisionObject3D", true, false).size(), 0, "never blocks movement or the beam")
	grid.free()
