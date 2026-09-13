class_name GeoLoader
## Loads a map's COMPILED geometry (geo.json) — the merged, vertex-coloured mesh the game renders,
## not the raw editor blocks. Physics mirrors web Arena.tsx: movement collides with geo.collider (impassable
## blocks), the floor and four tall invisible bounds; the beam hits only the raycast render groups.
## Floor + floor colour come from raw.json (geo has no floor plane).

const BOUND_H := 32.0               # half-height of the invisible perimeter walls (web BOUND_H): no jumping out
const BOUND_T := 0.5                # half-thickness of the invisible perimeter walls (web BOUND_T)
const FLOOR_HALF_THICKNESS := 0.5   # floor collider hangs below y=0, top face at y=0 (web CuboidCollider)
const DEFAULT_FLOOR_COLOR := "#3a3f47"
const TRANSPARENT_OPACITY := 0.3    # see-through blocks
const TRIANGLE_VERTS := 3

static func build(raw_path: String, geo_path: String) -> Node3D:
	var root := Node3D.new()
	root.name = "Map"
	var raw := MapFiles.read_json(raw_path)
	var half: Array = raw["half"]
	var hx := float(half[0])
	var hz := float(half[1])
	root.add_child(_floor(hx, hz, str(raw.get("floorColor", DEFAULT_FLOOR_COLOR))))
	_add_bounds(root, hx, hz)
	root.add_child(FloorGrid.build(hx, hz))   # web Arena.tsx: 1 m floor grid

	var geo := MapFiles.read_json(geo_path)
	var beam_targets := PackedVector3Array()
	for chunk in geo["chunks"]:
		_add_mesh(root, chunk.get("opaqueRaycast"), false)
		_add_mesh(root, chunk.get("opaqueNoRaycast"), false)
		_add_mesh(root, chunk.get("transparentRaycast"), true)
		_add_mesh(root, chunk.get("transparentNoRaycast"), true)
		_collect(beam_targets, chunk.get("opaqueRaycast"))
		_collect(beam_targets, chunk.get("transparentRaycast"))
	var solid := PackedVector3Array()
	_collect(solid, geo.get("collider"))
	if beam_targets.size() >= TRIANGLE_VERTS:
		root.add_child(_trimesh_body(beam_targets, CombatConst.LAYER_BEAM_ONLY_BIT))   # beam only (web raycast meshes)
	if solid.size() >= TRIANGLE_VERTS:
		root.add_child(_trimesh_body(solid, CombatConst.LAYER_WORLD_NOBEAM_BIT))       # movement only (web collider)
	return root

static func _floats(b64: String) -> PackedFloat32Array:
	return Marshalls.base64_to_raw(b64).to_float32_array()

static func _verts(b64: String) -> PackedVector3Array:
	var f := _floats(b64)
	var out := PackedVector3Array()
	out.resize(f.size() / 3)
	for i in out.size():
		out[i] = Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2])
	return out

static func _add_mesh(root: Node3D, m, transparent: bool) -> void:
	if m == null:
		return
	var cf := _floats(m["color"])
	var cols := PackedColorArray()
	cols.resize(cf.size() / 3)
	for i in cols.size():
		cols[i] = Color(cf[i * 3], cf[i * 3 + 1], cf[i * 3 + 2])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = _verts(m["position"])
	arr[Mesh.ARRAY_NORMAL] = _verts(m["normal"])
	arr[Mesh.ARRAY_COLOR] = cols
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	if transparent:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(1, 1, 1, TRANSPARENT_OPACITY)
	mi.material_override = mat
	root.add_child(mi)

static func _collect(acc: PackedVector3Array, m) -> void:
	if m != null:
		acc.append_array(_verts(m["position"]))

static func _trimesh_body(faces: PackedVector3Array, layer: int) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = layer
	sb.collision_mask = 0
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	var cs := CollisionShape3D.new()
	cs.shape = shape
	sb.add_child(cs)
	return sb

## A static box collider given web-style half-extents and a centre.
static func _box_body(half_extents: Vector3, center: Vector3, layer: int) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = layer
	sb.collision_mask = 0
	var box := BoxShape3D.new()
	box.size = half_extents * 2.0
	var cs := CollisionShape3D.new()
	cs.shape = box
	cs.position = center
	sb.add_child(cs)
	return sb

## Four tall invisible walls on the arena edges (web Arena.tsx): movement only, the beam flies through.
static func _add_bounds(root: Node3D, hx: float, hz: float) -> void:
	var walls := [
		[Vector3(hx, BOUND_H, BOUND_T), Vector3(0, BOUND_H, -hz)],
		[Vector3(hx, BOUND_H, BOUND_T), Vector3(0, BOUND_H, hz)],
		[Vector3(BOUND_T, BOUND_H, hz), Vector3(-hx, BOUND_H, 0)],
		[Vector3(BOUND_T, BOUND_H, hz), Vector3(hx, BOUND_H, 0)],
	]
	for i in walls.size():
		var body := _box_body(walls[i][0], walls[i][1], CombatConst.LAYER_WORLD_NOBEAM_BIT)
		body.name = "Bound%d" % i
		root.add_child(body)

## Floor: solid for movement, invisible to the beam (web: noRaycast plane + CuboidCollider).
static func _floor(hx: float, hz: float, color: String) -> StaticBody3D:
	var half_extents := Vector3(hx, FLOOR_HALF_THICKNESS, hz)
	var center := Vector3(0, -FLOOR_HALF_THICKNESS, 0)
	var sb := _box_body(half_extents, center, CombatConst.LAYER_WORLD_NOBEAM_BIT)
	sb.name = "Floor"
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = half_extents * 2.0
	mi.mesh = mesh
	mi.position = center
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color)
	mi.material_override = mat
	sb.add_child(mi)
	return sb
