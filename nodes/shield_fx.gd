class_name ShieldFx extends Node3D
## Shield skins — ports of web DomeShieldFx (translucent fill + three.js wireframe sphere pulsing together),
## HexShieldFx (36 additive hexagon tiles on a Fibonacci sphere, a top-to-bottom flash wave on activation, then a
## shimmer) and CrystalShieldFx (icosahedron fill + edges, one additive face lit at a time). Always #4af.

const TILE_SHADER := preload("res://assets/shaders/additive_double_sided.gdshader")
const ICOSA_T := (1.0 + sqrt(5.0)) / 2.0
# web IcosahedronGeometry vertices / face indices (the face order decides the crystal flicker sequence).
const ICOSA_VERTICES := [
	Vector3(-1, ICOSA_T, 0), Vector3(1, ICOSA_T, 0), Vector3(-1, -ICOSA_T, 0), Vector3(1, -ICOSA_T, 0),
	Vector3(0, -1, ICOSA_T), Vector3(0, 1, ICOSA_T), Vector3(0, -1, -ICOSA_T), Vector3(0, 1, -ICOSA_T),
	Vector3(ICOSA_T, 0, -1), Vector3(ICOSA_T, 0, 1), Vector3(-ICOSA_T, 0, -1), Vector3(-ICOSA_T, 0, 1),
]
const ICOSA_FACES := [
	0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
	1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
	3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
	4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
]
const TRIANGLE := 3
const DIAMETER := 2.0
const POLE_EPS := 0.999

var _state := ShieldSkinState.new()
var _root: Node3D
var _fill_material: StandardMaterial3D
var _wire_material: StandardMaterial3D
var _tiles: Array[MeshInstance3D] = []
var _faces: Array[MeshInstance3D] = []

func _ready() -> void:
	if _root == null:
		setup(ShieldSkinState.DOME)

func setup(style: String) -> void:
	_state = ShieldSkinState.new(style)
	var was_visible := _root != null and _root.visible
	if _root != null:
		remove_child(_root)
		_root.free()
	_tiles.clear()
	_faces.clear()
	_root = Node3D.new()
	_root.name = "Shield"
	_root.visible = was_visible
	add_child(_root)
	match _state.style:
		ShieldSkinState.HEX:
			_build_hex()
		ShieldSkinState.CRYSTAL:
			_build_crystal()
		_:
			_build_dome()

func style() -> String:
	return _state.style

func show_dome(on: bool) -> void:
	_root.visible = on

func is_dome_visible() -> bool:
	return _root.visible

func tiles() -> Array[MeshInstance3D]:
	return _tiles

func faces() -> Array[MeshInstance3D]:
	return _faces

## web Shield.update -> shieldFx.update(dt, visible): animate while the bubble shows.
func update(dt: float) -> void:
	_state.update(dt, _root.visible)
	if not _root.visible:
		return
	match _state.style:
		ShieldSkinState.HEX:
			for i in _tiles.size():
				_tiles[i].set_instance_shader_parameter("opacity", _state.hex_tile_opacity(i))
		ShieldSkinState.CRYSTAL:
			var lit := _state.crystal_lit_face()
			for i in _faces.size():
				_faces[i].visible = i == lit
		_:
			_fill_material.albedo_color.a = _state.dome_fill_opacity()
			_wire_material.albedo_color.a = _state.dome_wire_opacity()

func _build_dome() -> void:
	var sphere := SphereMesh.new()
	sphere.radius = ShieldSkinState.DOME_FILL_RADIUS
	sphere.height = ShieldSkinState.DOME_FILL_RADIUS * DIAMETER
	sphere.radial_segments = ShieldSkinState.DOME_FILL_SEGMENTS
	sphere.rings = ShieldSkinState.DOME_FILL_SEGMENTS
	_fill_material = _translucent(ShieldSkinState.DOME_FILL_BASE)
	_add_mesh(sphere, _fill_material)
	_wire_material = _translucent(ShieldSkinState.DOME_WIRE_BASE)
	_add_mesh(_wire_sphere(ShieldSkinState.DOME_WIRE_RADIUS, ShieldSkinState.DOME_WIRE_SEGMENTS_W,
		ShieldSkinState.DOME_WIRE_SEGMENTS_H), _wire_material)

func _build_hex() -> void:
	var hexagon := _polygon(ShieldSkinState.HEX_TILE_RADIUS, ShieldSkinState.HEX_TILE_SIDES)
	var material := ShaderMaterial.new()
	material.shader = TILE_SHADER
	material.set_shader_parameter("color", ShieldSkinState.COLOR)
	for i in ShieldSkinState.HEX_TILES:
		var direction := ShieldSkinState.hex_tile_direction(i)
		var position_at := direction * ShieldSkinState.HEX_RADIUS
		var up := Vector3.RIGHT if absf(direction.y) > POLE_EPS else Vector3.UP
		var tile := _add_mesh(hexagon, material)
		tile.transform = Transform3D(Basis.looking_at(-position_at, up), position_at)   # tangent: facing the centre
		tile.set_instance_shader_parameter("opacity", ShieldSkinState.HEX_BASE_OPACITY)
		_tiles.append(tile)

func _build_crystal() -> void:
	var corners: Array[Vector3] = []
	for v in ICOSA_VERTICES:
		corners.append((v as Vector3).normalized() * ShieldSkinState.CRYSTAL_RADIUS)
	var triangles := PackedVector3Array()
	for i in ICOSA_FACES.size():
		triangles.append(corners[ICOSA_FACES[i]])
	_add_mesh(_surface(triangles, Mesh.PRIMITIVE_TRIANGLES), _translucent(ShieldSkinState.CRYSTAL_FILL_OPACITY))
	_add_mesh(_surface(_triangle_edges(triangles), Mesh.PRIMITIVE_LINES),
		_translucent(ShieldSkinState.CRYSTAL_EDGE_OPACITY))
	var face_material := _translucent(ShieldSkinState.CRYSTAL_FACE_OPACITY)
	face_material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	for f in ShieldSkinState.CRYSTAL_FACES:
		var face := _add_mesh(_surface(triangles.slice(f * TRIANGLE, (f + 1) * TRIANGLE), Mesh.PRIMITIVE_TRIANGLES),
			face_material)
		face.scale = Vector3.ONE * ShieldSkinState.CRYSTAL_FACE_SCALE
		face.visible = false
		_faces.append(face)

## three.js SphereGeometry(radius, w, h) drawn as a wireframe: every triangle edge, pole caps without degenerates.
func _wire_sphere(radius: float, width_segments: int, height_segments: int) -> ArrayMesh:
	var grid := []
	for iy in height_segments + 1:
		var row: Array[Vector3] = []
		var theta := PI * iy / height_segments
		for ix in width_segments + 1:
			var phi := TAU * ix / width_segments
			row.append(Vector3(-radius * cos(phi) * sin(theta), radius * cos(theta), radius * sin(phi) * sin(theta)))
		grid.append(row)
	var triangles := PackedVector3Array()
	for iy in height_segments:
		for ix in width_segments:
			var a: Vector3 = grid[iy][ix + 1]
			var b: Vector3 = grid[iy][ix]
			var c: Vector3 = grid[iy + 1][ix]
			var d: Vector3 = grid[iy + 1][ix + 1]
			if iy != 0:
				triangles.append_array([a, b, d])
			if iy != height_segments - 1:
				triangles.append_array([b, c, d])
	return _surface(_triangle_edges(triangles), Mesh.PRIMITIVE_LINES)

## Unique edges of a triangle list as line pairs.
func _triangle_edges(triangles: PackedVector3Array) -> PackedVector3Array:
	var seen := {}
	var lines := PackedVector3Array()
	for t in range(0, triangles.size(), TRIANGLE):
		for e in TRIANGLE:
			var p := triangles[t + e]
			var q := triangles[t + (e + 1) % TRIANGLE]
			var key := [p.snappedf(1e-4), q.snappedf(1e-4)]
			key.sort_custom(func(x, y): return x < y)
			if seen.has(str(key)):
				continue
			seen[str(key)] = true
			lines.append_array([p, q])
	return lines

## web CircleGeometry(radius, sides): a flat fan in the XY plane, first corner on +X.
func _polygon(radius: float, sides: int) -> ArrayMesh:
	var triangles := PackedVector3Array()
	for i in sides:
		var a := TAU * i / sides
		var b := TAU * (i + 1) / sides
		triangles.append_array([Vector3.ZERO, Vector3(cos(a), sin(a), 0.0) * radius, Vector3(cos(b), sin(b), 0.0) * radius])
	return _surface(triangles, Mesh.PRIMITIVE_TRIANGLES)

func _surface(points: PackedVector3Array, primitive: Mesh.PrimitiveType) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = points
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(primitive, arrays)
	return mesh

func _translucent(alpha: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(ShieldSkinState.COLOR, alpha)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	return material

func _add_mesh(mesh: Mesh, material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_root.add_child(instance)
	return instance
