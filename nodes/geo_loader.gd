class_name GeoLoader
## Builds a map from its imported resources: the compiled geometry (MapGeo — the merged, vertex-coloured mesh the game
## renders, not the raw editor blocks) and the map's source (half, floor colour, spawns, blocks). Physics mirrors web
## Arena.tsx: movement collides with the geometry's collider (impassable blocks), the floor and four tall invisible
## bounds; the beam hits only the raycast groups. Floor and floor colour come from the source (geo has no floor plane).

const BOUND_H := 32.0               # half-height of the invisible perimeter walls (web BOUND_H): no jumping out
const BOUND_T := 0.5                # half-thickness of the invisible perimeter walls (web BOUND_T)
const FLOOR_HALF_THICKNESS := 0.5   # floor collider hangs below y=0, top face at y=0 (web CuboidCollider)
const DEFAULT_FLOOR_COLOR := "#3a3f47"
const TRIANGLE_VERTS := 3

static func build(raw_path: String, geo_path: String) -> Node3D:
	var root := Node3D.new()
	root.name = "Map"
	var raw := MapFiles.read_map(raw_path)
	var half: Array = raw["half"]
	var hx := float(half[0])
	var hz := float(half[1])
	root.add_child(_floor(hx, hz, str(raw.get("floorColor", DEFAULT_FLOOR_COLOR))))
	_add_bounds(root, hx, hz)
	root.add_child(FloorGrid.build(hx, hz))   # web Arena.tsx: 1 m floor grid
	if raw.get("showBlockGrid", false):        # web Arena.tsx: voxel cell edges, only when the map asks
		root.add_child(BlockGridMesh.build(BlockGrid.cells(raw["blocks"])))

	var geo := load(geo_path) as MapGeo
	for group in geo.groups:
		_add_mesh(root, group)
	var beam_targets := geo.beam_faces()
	if beam_targets.size() >= TRIANGLE_VERTS:
		root.add_child(_trimesh_body(beam_targets, CombatConst.LAYER_BEAM_ONLY_BIT))   # beam only (web raycast meshes)
	if geo.collider.size() >= TRIANGLE_VERTS:
		root.add_child(_trimesh_body(geo.collider, CombatConst.LAYER_WORLD_NOBEAM_BIT))  # movement only (web collider)
	return root

static func _add_mesh(root: Node3D, group: MapGeoGroup) -> void:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = group.position
	arr[Mesh.ARRAY_NORMAL] = group.normal
	arr[Mesh.ARRAY_COLOR] = group.color
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mi.material_override = mat
	MapBlocks.mark(mi, MapBlocks.GLASS_OPACITY if group.transparent else MapBlocks.OPAQUE)   # web userData.block
	if group.raycast:
		MapEdges.mark_block(mi)   # web BLOCK_LAYER: only the raycast groups get the edge outline
	root.add_child(mi)

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
