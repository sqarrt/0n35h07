class_name DashTrailView extends Node3D
## The dash trail skin in world space — web createDashFx: STREAK (AfterimageTrail speed clones in the player colour),
## WAVE (expanding shockwave rings across the motion) or RIFT (R / G / B ball copies split across the motion).

const STYLE_STREAK := "streak"
const STYLE_WAVE := "wave"
const STYLE_RIFT := "rift"
const RING_SHADER := preload("res://assets/shaders/additive_double_sided.gdshader")
const SPHERE_SHADER := preload("res://assets/shaders/additive_particle.gdshader")
const RIFT_SPHERE_SEGMENTS := 8
const DIAMETER := 2.0

var _style := STYLE_STREAK
var _streak: AfterimageTrail
var _streak_view: ParticleView
var _wave: WaveTrail
var _rift: RiftTrail
var _meshes: Array[MeshInstance3D] = []      # wave rings, or rift copies (POOL × 3 channels)

## Build the trail for a style in the player colour (RIFT ignores the colour: pure R / G / B channels).
func setup(style: String, color: Color) -> void:
	top_level = true
	_style = style if style in [STYLE_WAVE, STYLE_RIFT] else STYLE_STREAK
	for child in get_children():
		remove_child(child)
		child.free()
	_meshes.clear()
	match _style:
		STYLE_WAVE:
			_wave = WaveTrail.new()
			var ring := _ring_mesh()
			for i in WaveTrail.POOL:
				_meshes.append(_mesh(ring, RING_SHADER, color))
		STYLE_RIFT:
			_rift = RiftTrail.new()
			var sphere := SphereMesh.new()
			sphere.radius = RiftTrail.RADIUS
			sphere.height = RiftTrail.RADIUS * DIAMETER
			sphere.radial_segments = RIFT_SPHERE_SEGMENTS
			sphere.rings = RIFT_SPHERE_SEGMENTS
			for i in RiftTrail.POOL:
				for channel in RiftTrail.CHANNELS.size():
					_meshes.append(_mesh(sphere, SPHERE_SHADER, RiftTrail.CHANNELS[channel]))
		_:
			_streak = AfterimageTrail.new(color)
			_streak_view = ParticleView.new()
			add_child(_streak_view)
			_streak_view.setup(_streak.pool, SkinCurves.DASH_TRAIL_RADIUS, color)

func style() -> String:
	return _style

## `eye` is the player's eye point (web DashTrailContext.position).
func update(dt: float, dashing: bool, eye: Vector3) -> void:
	match _style:
		STYLE_WAVE:
			_wave.update(dt, dashing, eye)
			for i in WaveTrail.POOL:
				var mesh := _meshes[i]
				mesh.visible = _wave.alive(i)
				if mesh.visible:
					var basis := Basis(Quaternion(Vector3.BACK, _wave.normals[i])).scaled(Vector3.ONE * _wave.scale(i))
					mesh.global_transform = Transform3D(basis, _wave.positions[i])
					mesh.set_instance_shader_parameter("opacity", _wave.opacity(i))
		STYLE_RIFT:
			_rift.update(dt, dashing, eye)
			var channels := RiftTrail.CHANNELS.size()
			for i in RiftTrail.POOL:
				for channel in channels:
					var mesh := _meshes[i * channels + channel]
					mesh.visible = _rift.alive(i)
					if mesh.visible:
						mesh.global_position = _rift.channel_position(i, channel)
						mesh.set_instance_shader_parameter("opacity", _rift.opacity(i))
		_:
			_streak.update(dt, dashing, eye)
			_streak_view.refresh()

func visible_count() -> int:
	if _style == STYLE_STREAK:
		return _streak_view.visible_count()
	return _meshes.filter(func(m): return m.visible).size()

func _mesh(mesh: Mesh, shader: Shader, color: Color) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("color", color)
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	instance.visible = false
	add_child(instance)
	return instance

## web RingGeometry(0.3, 0.38, 24): a flat annulus in the XY plane, normal +Z.
func _ring_mesh() -> ArrayMesh:
	var vertices := PackedVector3Array()
	var indices := PackedInt32Array()
	for i in WaveTrail.SEGMENTS + 1:
		var angle := TAU * i / WaveTrail.SEGMENTS
		var dir := Vector3(cos(angle), sin(angle), 0.0)
		vertices.append(dir * WaveTrail.INNER)
		vertices.append(dir * WaveTrail.OUTER)
	for i in WaveTrail.SEGMENTS:
		var a := i * 2
		indices.append_array([a, a + 1, a + 3, a, a + 3, a + 2])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh
