class_name MapLoader
## Builds arena geometry from a web map raw.json: floor + box blocks with beam/no-beam layers.
## Wedge (ramp) blocks are skipped for now — the next slice adds the triangular-prism geometry.

static func build(path: String) -> Node3D:
	var f := FileAccess.open(path, FileAccess.READ)
	var data: Dictionary = JSON.parse_string(f.get_as_text())
	var root := Node3D.new()
	root.name = "Map"
	var half: Array = data["half"]
	var hx := float(half[0])
	var hz := float(half[1])
	# Floor.
	root.add_child(_box(Vector3(0, -0.5, 0), Vector3(hx * 2.0, 1.0, hz * 2.0),
		str(data.get("floorColor", "#3a3f47")), CombatConst.LAYER_WORLD_BIT))
	for b in data["blocks"]:
		var pos: Array = b["pos"]
		var size: Array = b["size"]
		var center := Vector3(pos[0], pos[1], pos[2])
		var box_size := Vector3(size[0], size[1], size[2])
		var color := str(b.get("color", "#888888"))
		var layer := CombatConst.LAYER_WORLD_BIT if bool(b.get("blocksBeam", true)) else CombatConst.LAYER_WORLD_NOBEAM_BIT
		if b.get("shape", "box") == "wedge":
			root.add_child(_wedge(center, box_size, color, int(b.get("dir", 0)), bool(b.get("flip", false)), layer))
		else:
			root.add_child(_box(center, box_size, color, layer))
	return root

## Wedge (half-cube ramp) — a triangular prism, dir rotates it around Y, flip mirrors the slope.
## Ported from web wedge.ts (unit-cube geometry, scaled by size).
static func _wedge(center: Vector3, size: Vector3, color: String, dir: int, flip: bool, layer: int) -> StaticBody3D:
	var a0 := Vector3(-0.5, -0.5, -0.5)
	var b0 := Vector3(-0.5, -0.5, 0.5)
	var c0 := Vector3(-0.5, 0.5, 0.5)
	var a1 := Vector3(0.5, -0.5, -0.5)
	var b1 := Vector3(0.5, -0.5, 0.5)
	var c1 := Vector3(0.5, 0.5, 0.5)
	var tris := [
		[a0, a1, b1], [a0, b1, b0],   # bottom
		[b1, c1, c0], [b1, c0, b0],   # back wall
		[a0, c0, c1], [a0, c1, a1],   # slope
		[a0, b0, c0], [a1, c1, b1],   # side triangles
	]
	var sb := StaticBody3D.new()
	sb.collision_layer = layer
	sb.collision_mask = 0
	sb.position = center
	sb.rotation.y = -dir * (PI / 2.0)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for t in tris:
		var tri: Array = [t[0], t[2], t[1]] if flip else t   # reverse winding when mirrored
		for v in tri:
			st.add_vertex(_wv(v, flip, size))
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color)
	mi.material_override = mat
	sb.add_child(mi)

	var pts := PackedVector3Array()
	for v in [a0, b0, c0, a1, b1, c1]:
		pts.append(_wv(v, flip, size))
	var shape := ConvexPolygonShape3D.new()
	shape.points = pts
	var cs := CollisionShape3D.new()
	cs.shape = shape
	sb.add_child(cs)
	return sb

static func _wv(v: Vector3, flip: bool, size: Vector3) -> Vector3:
	var y := -v.y if flip else v.y
	return Vector3(v.x * size.x, y * size.y, v.z * size.z)

static func _box(center: Vector3, size: Vector3, color: String, layer: int) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = layer
	sb.collision_mask = 0
	sb.position = center
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	sb.add_child(cs)
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color)
	mi.material_override = mat
	sb.add_child(mi)
	return sb
