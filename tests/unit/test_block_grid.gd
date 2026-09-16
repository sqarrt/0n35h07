extends GutTest
## Block (voxel cell) grid parity with web blockGrid.ts: cells occupied by map blocks, 12 edges per cell,
## drawn as translucent #4af lines only on maps with showBlockGrid.

const POOL_RAW := "res://maps/os_pool_day.map"
const POOL_GEO := "res://maps/os_pool_day.geo"
const ARENA_RAW := "res://maps/os_arena.map"
const ARENA_GEO := "res://maps/os_arena.geo"
const POOL_CELLS := 17210          # web blockCells(os_pool_day) — cross-checked with a port of the JS algorithm
const EDGES_PER_CELL := 12
const VERTS_PER_EDGE := 2
const CUBE_CELLS_PER_AXIS := 2     # a 1 m cube spans two 0.5 m voxels per axis

func _cube(pos: Array, size: Array) -> Dictionary:
	return {"pos": pos, "size": size, "color": "#555"}

func test_cube_fills_its_voxel_cells() -> void:
	var cells := BlockGrid.cells([_cube([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])])
	assert_eq(cells.size(), CUBE_CELLS_PER_AXIS * CUBE_CELLS_PER_AXIS * CUBE_CELLS_PER_AXIS)
	assert_eq(cells[0], Vector3i(0, 0, 0))

func test_perimeter_blocks_are_not_voxels() -> void:
	var wall := _cube([0, 1.5, -20.25], [20, 1.5, 0.25])
	wall["perimeter"] = true
	assert_eq(BlockGrid.cells([wall]).size(), 0)

func test_wedge_takes_a_single_cell() -> void:
	var wedge := {"pos": [8.25, 4.25, -5.25], "size": [0.25, 0.25, 0.25], "shape": "wedge", "dir": 3}
	assert_eq(BlockGrid.cells([wedge]), [Vector3i(16, 8, -11)])

func test_half_cell_edges_round_like_js_math_round() -> void:
	# (pos - size) / VOXEL = -0.5: JS Math.round gives 0 (GDScript round() would give -1), so the span is empty.
	assert_eq(BlockGrid.cells([_cube([-0.125, 0.5, 0.5], [0.125, 0.5, 0.5])]).size(), 0)

func test_overlapping_blocks_share_cells() -> void:
	var block := _cube([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
	assert_eq(BlockGrid.cells([block, block.duplicate(true)]).size(), BlockGrid.cells([block]).size())

func test_pool_cell_count_matches_web() -> void:
	assert_eq(BlockGrid.cells(MapFiles.read_map(POOL_RAW)["blocks"]).size(), POOL_CELLS)

func test_each_cell_has_twelve_edges_on_the_voxel_lattice() -> void:
	var verts := BlockGrid.edge_vertices([Vector3i(0, 0, 0)])
	assert_eq(verts.size(), EDGES_PER_CELL * VERTS_PER_EDGE)
	assert_eq(verts[0], Vector3(0, 0, 0), "edge 0 starts at corner 0")
	assert_eq(verts[1], Vector3(BlockGrid.VOXEL, 0, 0), "and ends at corner 1")

func test_grid_mesh_is_translucent_unlit_and_never_collides() -> void:
	var grid := BlockGridMesh.build([Vector3i(0, 0, 0)])
	var mat := grid.material_override as StandardMaterial3D
	assert_eq(mat.shading_mode, BaseMaterial3D.SHADING_MODE_UNSHADED)
	assert_eq(mat.transparency, BaseMaterial3D.TRANSPARENCY_ALPHA)
	assert_eq(mat.albedo_color, BlockGridMesh.COLOR)
	assert_almost_eq(BlockGridMesh.COLOR.a, BlockGridMesh.OPACITY, 0.001)
	assert_eq(grid.find_children("*", "CollisionObject3D", true, false).size(), 0)
	grid.free()

func test_geo_loader_adds_the_grid_only_when_the_map_asks() -> void:
	var pool := GeoLoader.build(POOL_RAW, POOL_GEO)
	assert_not_null(pool.find_child("BlockGrid", false, false), "os_pool_day has showBlockGrid")
	pool.free()
	var arena := GeoLoader.build(ARENA_RAW, ARENA_GEO)
	assert_null(arena.find_child("BlockGrid", false, false), "maps without showBlockGrid draw none")
	arena.free()
