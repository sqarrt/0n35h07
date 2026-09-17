class_name BlockGrid
## Voxel cell grid of a map — port of web blockGrid.ts (blockCells + cellsGridGeometry). Cells are the
## VOXEL-sized lattice cubes occupied by map blocks; each cell contributes its 12 edges as line segments.

const VOXEL := 0.5              # web VOXEL: edge of the base map cube
const EPS := 1e-3               # wedge-to-cell snap tolerance (web EPS)
const HALF := 0.5
const VERTS_PER_EDGE := 2
const WEDGE := "wedge"
# Unit cell corners (half-edge offsets) and the 12 edges as corner index pairs — same order as the web.
const EDGE_CORNERS := [
	Vector3(-0.5, -0.5, -0.5), Vector3(0.5, -0.5, -0.5), Vector3(0.5, -0.5, 0.5), Vector3(-0.5, -0.5, 0.5),
	Vector3(-0.5, 0.5, -0.5), Vector3(0.5, 0.5, -0.5), Vector3(0.5, 0.5, 0.5), Vector3(-0.5, 0.5, 0.5),
]
const EDGE_PAIRS := [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

## Cells occupied by map blocks (perimeter walls are not voxels), without repeats, in first-seen order.
static func cells(blocks: Array) -> Array:
	var seen := {}
	var out: Array = []
	for b in blocks:
		if b.get("perimeter", false) == true:
			continue
		var pos: Array = b["pos"]
		var size: Array = b["size"]
		if b.get("shape", "") == WEDGE:   # a wedge is a sub-cell prism: exactly one cell
			_add(Vector3i(_wedge_cell(pos[0] - size[0]), _wedge_cell(pos[1] - size[1]), _wedge_cell(pos[2] - size[2])), seen, out)
			continue
		var lo := Vector3i(_js_round((pos[0] - size[0]) / VOXEL), _js_round((pos[1] - size[1]) / VOXEL), _js_round((pos[2] - size[2]) / VOXEL))
		var hi := Vector3i(_js_round((pos[0] + size[0]) / VOXEL), _js_round((pos[1] + size[1]) / VOXEL), _js_round((pos[2] + size[2]) / VOXEL))
		for x in range(lo.x, hi.x):
			for y in range(lo.y, hi.y):
				for z in range(lo.z, hi.z):
					_add(Vector3i(x, y, z), seen, out)
	return out

## Line-segment vertices over the 12 edges of every cell (web cellsGridGeometry).
static func edge_vertices(cell_list: Array) -> PackedVector3Array:
	var verts := PackedVector3Array()
	verts.resize(cell_list.size() * EDGE_PAIRS.size() * VERTS_PER_EDGE)
	var i := 0
	for c in cell_list:
		var center := (Vector3(c) + Vector3.ONE * HALF) * VOXEL
		for pair in EDGE_PAIRS:
			verts[i] = center + EDGE_CORNERS[pair[0]] * VOXEL
			verts[i + 1] = center + EDGE_CORNERS[pair[1]] * VOXEL
			i += VERTS_PER_EDGE
	return verts

## JS Math.round: halves round toward +infinity (GDScript round() rounds -0.5 away from zero).
static func _js_round(v: float) -> int:
	return floori(v + HALF)

static func _wedge_cell(v: float) -> int:
	return floori((v + EPS) / VOXEL)

static func _add(cell: Vector3i, seen: Dictionary, out: Array) -> void:
	if not seen.has(cell):
		seen[cell] = true
		out.append(cell)
