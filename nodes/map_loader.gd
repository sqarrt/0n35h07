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
	var skipped := 0
	for b in data["blocks"]:
		if b.get("shape", "box") == "wedge":
			skipped += 1
			continue
		var pos: Array = b["pos"]
		var size: Array = b["size"]
		var layer := CombatConst.LAYER_WORLD_BIT if bool(b.get("blocksBeam", true)) else CombatConst.LAYER_WORLD_NOBEAM_BIT
		root.add_child(_box(Vector3(pos[0], pos[1], pos[2]), Vector3(size[0], size[1], size[2]),
			str(b.get("color", "#888888")), layer))
	if skipped > 0:
		print("MapLoader: skipped ", skipped, " wedge (ramp) blocks — TODO in the wedge slice")
	return root

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
