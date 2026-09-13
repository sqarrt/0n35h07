class_name BallVisual extends Node3D
## The player's ball — port of web Body's mesh (SphereGeometry R 0.5, 128 segments, casting shadows) with
## createBallMaterial / createBallRing: player colour, the `waves` vertex waves, the `planet` ring in the reserve colour,
## the ball artwork, ghost opacity and a yaw-only facing along the look direction.

const BALL_SHADER := preload("res://assets/shaders/ball.gdshader")
const RING_SHADER := preload("res://assets/shaders/ball_ring.gdshader")
const SEGMENTS := 128               # web BALL_SEGMENTS
const RING_INNER := 0.62            # web BALL_RING_INNER
const RING_OUTER := 1.0
const RING_SEGMENTS := 96
const RING_TILT_DEG := 70.0
const MODEL_WAVES := "waves"
const MODEL_PLANET := "planet"
const DIAMETER := 2.0
const MIN_FACING_SQ := 1e-8

var _mesh: MeshInstance3D
var _material: ShaderMaterial
var _ring: MeshInstance3D
var _ring_material: ShaderMaterial
var _time := 0.0

func _init() -> void:
	_mesh = MeshInstance3D.new()
	_mesh.name = "Ball"
	var sphere := SphereMesh.new()
	sphere.radius = MoveConst.BALL_RADIUS
	sphere.height = MoveConst.BALL_RADIUS * DIAMETER
	sphere.radial_segments = SEGMENTS
	sphere.rings = SEGMENTS
	_mesh.mesh = sphere
	_material = ShaderMaterial.new()
	_material.shader = BALL_SHADER
	_mesh.material_override = _material
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(_mesh)

## Colour, model ("smooth" / "waves" / "planet"), the planet ring colour and the stored artwork string.
func setup(color: Color, model: String, ring_color: Color, art := "") -> void:
	set_color(color)
	_material.set_shader_parameter("waves", model == MODEL_WAVES)
	_material.set_shader_parameter("art", BallArt.texture(art))
	if model == MODEL_PLANET and _ring == null:
		_ring = MeshInstance3D.new()
		_ring.name = "Ring"
		_ring.mesh = _ring_mesh()
		_ring_material = ShaderMaterial.new()
		_ring_material.shader = RING_SHADER
		_ring.material_override = _ring_material
		_ring.rotation_degrees.x = RING_TILT_DEG
		_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_mesh.add_child(_ring)   # scales and fades with the planet
	if _ring != null:
		_ring_material.set_shader_parameter("ring_color", ring_color)

func set_color(color: Color) -> void:
	_material.set_shader_parameter("albedo", color)

## Linear emissive colour (rage windup glow).
func set_emission(emission: Color) -> void:
	_material.set_shader_parameter("emission", Vector3(emission.r, emission.g, emission.b))

func set_scale_factor(factor: float) -> void:
	_mesh.scale = Vector3.ONE * factor

## Ghost / materialisation opacity for the ball and its ring (instance transparency keeps the shadow).
func set_opacity(opacity: float) -> void:
	_mesh.transparency = 1.0 - opacity
	if _ring != null:
		_ring_material.set_shader_parameter("opacity", opacity)

## Visual-only offset of the ball mesh (the chaos respawn jitter; physics stays put).
func set_mesh_offset(offset: Vector3) -> void:
	_mesh.position = offset

## Hide just the ball (the swarm respawn fragments mark the player instead).
func set_mesh_visible(shown: bool) -> void:
	_mesh.visible = shown

## web Body.faceDir: yaw only, so looking up or down never tilts the model.
func face_dir(direction: Vector3) -> void:
	var flat := Vector3(direction.x, 0.0, direction.z)
	if flat.length_squared() < MIN_FACING_SQ:
		return
	_mesh.rotation.y = atan2(-flat.x, -flat.z)

func tick(dt: float) -> void:
	_time += dt
	_material.set_shader_parameter("time", _time)
	if _ring != null:
		_ring_material.set_shader_parameter("time", _time)

func ball() -> MeshInstance3D:
	return _mesh

func ring() -> MeshInstance3D:
	return _ring

func material() -> ShaderMaterial:
	return _material

## Flat annulus in the XY plane (web RingGeometry(inner, outer, segments)).
func _ring_mesh() -> ArrayMesh:
	var vertices := PackedVector3Array()
	var indices := PackedInt32Array()
	for i in RING_SEGMENTS + 1:
		var angle := TAU * i / RING_SEGMENTS
		var dir := Vector3(cos(angle), sin(angle), 0.0)
		vertices.append(dir * RING_INNER)
		vertices.append(dir * RING_OUTER)
	for i in RING_SEGMENTS:
		var a := i * 2
		indices.append_array([a, a + 1, a + 3, a, a + 3, a + 2])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh
