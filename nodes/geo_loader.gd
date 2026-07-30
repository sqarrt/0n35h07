class_name GeoLoader
## Loads a map's COMPILED geometry (geo.json) — the merged, vertex-coloured mesh the game renders,
## not the raw editor blocks. Builds render meshes per chunk + beam/no-beam trimesh colliders.
## Floor + floor colour come from raw.json (geo has no floor plane).

static func build(raw_path: String, geo_path: String) -> Node3D:
	var root := Node3D.new()
	root.name = "Map"
	var raw: Dictionary = JSON.parse_string(FileAccess.open(raw_path, FileAccess.READ).get_as_text())
	var half: Array = raw["half"]
	root.add_child(_floor(float(half[0]), float(half[1]), str(raw.get("floorColor", "#3a3f47"))))

	var geo: Dictionary = JSON.parse_string(FileAccess.open(geo_path, FileAccess.READ).get_as_text())
	var beam := PackedVector3Array()
	var nobeam := PackedVector3Array()
	for chunk in geo["chunks"]:
		_add_mesh(root, chunk.get("opaqueRaycast"), false)
		_add_mesh(root, chunk.get("opaqueNoRaycast"), false)
		_add_mesh(root, chunk.get("transparentRaycast"), true)
		_add_mesh(root, chunk.get("transparentNoRaycast"), true)
		_collect(beam, chunk.get("opaqueRaycast"))
		_collect(beam, chunk.get("transparentRaycast"))
		_collect(nobeam, chunk.get("opaqueNoRaycast"))
		_collect(nobeam, chunk.get("transparentNoRaycast"))
	if beam.size() >= 3:
		root.add_child(_collider(beam, CombatConst.LAYER_WORLD_BIT))       # blocks beam + movement
	if nobeam.size() >= 3:
		root.add_child(_collider(nobeam, CombatConst.LAYER_WORLD_NOBEAM_BIT))  # movement only
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
		mat.albedo_color = Color(1, 1, 1, 0.3)
	mi.material_override = mat
	root.add_child(mi)

static func _collect(acc: PackedVector3Array, m) -> void:
	if m != null:
		acc.append_array(_verts(m["position"]))

static func _collider(faces: PackedVector3Array, layer: int) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = layer
	sb.collision_mask = 0
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	var cs := CollisionShape3D.new()
	cs.shape = shape
	sb.add_child(cs)
	return sb

static func _floor(hx: float, hz: float, color: String) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = CombatConst.LAYER_WORLD_BIT
	sb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(hx * 2.0, 1.0, hz * 2.0)
	cs.shape = box
	cs.position = Vector3(0, -0.5, 0)
	sb.add_child(cs)
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(hx * 2.0, 1.0, hz * 2.0)
	mi.mesh = mesh
	mi.position = Vector3(0, -0.5, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color)
	mi.material_override = mat
	sb.add_child(mi)
	return sb
