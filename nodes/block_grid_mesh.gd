class_name BlockGridMesh
## Draws a BlockGrid as translucent unlit lines (web lineSegments + lineBasicMaterial #4af, opacity 0.5).
## Visual only: no collider, never a beam target, casts no shadow.

const OPACITY := 0.5                                               # web BLOCK_GRID_OPACITY
const COLOR := Color(0x44 / 255.0, 0xaa / 255.0, 0xff / 255.0, OPACITY)   # web BLOCK_GRID_COLOR #4af

static func build(cell_list: Array) -> MeshInstance3D:
	var grid := MeshInstance3D.new()
	grid.name = "BlockGrid"
	grid.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = COLOR
	grid.material_override = mat
	if cell_list.is_empty():
		return grid   # nothing to draw (an empty surface is not allowed)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = BlockGrid.edge_vertices(cell_list)
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_LINES, arrays)
	grid.mesh = mesh
	return grid
