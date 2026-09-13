class_name FloorGrid
## Floor grid — port of web grid.ts + Arena.tsx: 1 m cells over [-hx, hx] × [-hz, hz], lines slightly above the
## floor (no z-fighting), unlit #555 GL lines. Visual only: no collider, never a beam target, casts no shadow.

const STEP := 1.0
const GRID_Y := 0.01
const COLOR := Color("#555555")
const EPS := 1e-6

static func build(hx: float, hz: float) -> MeshInstance3D:
	var verts := PackedVector3Array()
	var x := -hx
	while x <= hx + EPS:   # web order: lines along Z first
		verts.append(Vector3(x, GRID_Y, -hz))
		verts.append(Vector3(x, GRID_Y, hz))
		x += STEP
	var z := -hz
	while z <= hz + EPS:
		verts.append(Vector3(-hx, GRID_Y, z))
		verts.append(Vector3(hx, GRID_Y, z))
		z += STEP
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_LINES, arrays)

	var grid := MeshInstance3D.new()
	grid.name = "FloorGrid"
	grid.mesh = mesh
	grid.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = COLOR
	grid.material_override = mat
	return grid
