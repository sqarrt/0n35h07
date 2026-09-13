class_name ParticleView extends Node3D
## Draws a ParticlePool as additive low-poly spheres in world space (web SpritePool / DeathBurst meshes): one mesh per
## slot, shown while alive, scaled and faded by its life share.

const SHADER := preload("res://assets/shaders/additive_particle.gdshader")
const SPHERE_SEGMENTS := 8        # web SphereGeometry(radius, 8, 8)
const DIAMETER := 2.0
const TIE_SORT_OFFSET := 0.001    # same-centre ties draw after the ball, like three's id order (the ball is older)

var _pool: ParticlePool
var _meshes: Array[MeshInstance3D] = []

func setup(pool: ParticlePool, radius: float, color: Color) -> void:
	top_level = true   # particles stay where they were emitted while the player moves on
	_pool = pool
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * DIAMETER
	sphere.radial_segments = SPHERE_SEGMENTS
	sphere.rings = SPHERE_SEGMENTS
	var material := ShaderMaterial.new()
	material.shader = SHADER
	material.set_shader_parameter("color", color)
	for i in pool.size():
		var mesh := MeshInstance3D.new()
		mesh.mesh = sphere
		mesh.material_override = material
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mesh.sorting_offset = TIE_SORT_OFFSET
		mesh.visible = false
		add_child(mesh)
		_meshes.append(mesh)

## Mirror the pool into the meshes (call after stepping it).
func refresh() -> void:
	for i in _meshes.size():
		var mesh := _meshes[i]
		mesh.visible = _pool.alive(i)
		if not mesh.visible:
			continue
		mesh.global_position = _pool.position(i)
		mesh.scale = Vector3.ONE * _pool.scale(i)
		mesh.set_instance_shader_parameter("opacity", _pool.opacity(i))

func visible_count() -> int:
	return _meshes.filter(func(m): return m.visible).size()
