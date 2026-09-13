class_name WindupWorldView extends Node3D
## World-space windup skins — the web RageWindupFx jaw hologram (two arcs of additive teeth in front of the ball,
## opening with the charge, snapping shut, glitching) and the SingularityWindupFx vortex (48 additive square points
## spiralling into the ball) with its collapse flash. Classic has no world part.

const STYLE_RAGE := "rage"
const STYLE_SINGULARITY := "singularity"
const TOOTH_SHADER := preload("res://assets/shaders/additive_double_sided.gdshader")
const POINTS_SHADER := preload("res://assets/shaders/size_attenuated_points.gdshader")
const DIAMETER := 2.0
const MIN_FACING_SQ := 1e-8

var _style := ""
var _jaws: RageJaws
var _jaw_root: Node3D
var _upper: Node3D
var _lower: Node3D
var _teeth: Array[MeshInstance3D] = []
var _vortex: SingularityVortex
var _points: MeshInstance3D
var _points_mesh: ArrayMesh
var _points_material: ShaderMaterial
var _flash: MeshInstance3D
var _flash_material: StandardMaterial3D

## Build the world part of a windup style ("classic" builds nothing).
func setup(style: String, rng: Callable) -> void:
	top_level = true
	transform = Transform3D.IDENTITY   # turning top_level on in the tree keeps the player's offset otherwise
	for child in get_children():
		remove_child(child)
		child.free()
	_teeth.clear()
	_jaws = null
	_jaw_root = null
	_upper = null
	_lower = null
	_vortex = null
	_points = null
	_points_mesh = null
	_points_material = null
	_flash = null
	_flash_material = null
	_style = style
	match style:
		STYLE_RAGE:
			_jaws = RageJaws.new()
			_jaw_root = Node3D.new()
			add_child(_jaw_root)
			_upper = _jaw(true)
			_lower = _jaw(false)
		STYLE_SINGULARITY:
			_vortex = SingularityVortex.new(rng)
			_build_vortex()
	visible = false

func style() -> String:
	return _style

func teeth() -> Array[MeshInstance3D]:
	return _teeth

func points() -> MeshInstance3D:
	return _points

func flash() -> MeshInstance3D:
	return _flash

## One frame (web IWindupFx.apply world part): charge progress, deflate progress, ball centre, aim, own-view visibility.
func apply(dt: float, progress: float, shrink: float, origin: Vector3, aim: Vector3, shown: bool, rng: Callable) -> void:
	match _style:
		STYLE_RAGE:
			_apply_jaws(dt, progress, shrink, origin, aim, shown, rng)
		STYLE_SINGULARITY:
			_apply_vortex(dt, progress, shrink, origin, shown, rng)
		_:
			visible = false

func _apply_jaws(dt: float, progress: float, shrink: float, origin: Vector3, aim: Vector3, shown: bool,
		rng: Callable) -> void:
	visible = RageJaws.active(progress, shrink) and shown
	if not visible:
		return
	var forward := Vector3(aim.x, 0.0, aim.z)
	forward = Vector3.FORWARD if forward.length_squared() < MIN_FACING_SQ else forward.normalized()
	var glitching := _jaws.step_glitch(dt, rng)
	var position_at := origin + forward * RageJaws.DISTANCE + (_jaws.glitch_offset if glitching else Vector3.ZERO)
	_jaw_root.global_transform = Transform3D(Basis.looking_at(-forward), position_at)   # local +Z along the aim
	var open := RageJaws.open_amount(progress, shrink)
	_upper.position.y = open * RageJaws.OPEN_DIST
	_lower.position.y = -open * RageJaws.OPEN_DIST
	_upper.rotation.x = -open * RageJaws.OPEN_RAD
	_lower.rotation.x = open * RageJaws.OPEN_RAD
	var opacity := RageJaws.opacity(RageJaws.appear(progress, shrink), glitching)
	for tooth in _teeth:
		tooth.set_instance_shader_parameter("opacity", opacity)

func _apply_vortex(dt: float, progress: float, shrink: float, origin: Vector3, shown: bool, rng: Callable) -> void:
	var charging := progress > 0.0
	var flashing := not charging and shrink < 1.0
	visible = (charging or flashing) and shown
	if charging:
		_vortex.step(dt, progress, rng)
		var vertices := PackedVector3Array()
		vertices.resize(SingularityVortex.PARTICLES)
		for i in SingularityVortex.PARTICLES:
			vertices[i] = origin + _vortex.positions[i]
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		_points_mesh.clear_surfaces()
		_points_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_POINTS, arrays)
		_points_material.set_shader_parameter("opacity", SingularityVortex.vortex_opacity(progress))
		_points.visible = true
		_flash.visible = false
	elif flashing:
		_points.visible = false
		var f := SingularityVortex.flash(shrink)
		_flash.visible = f["visible"]
		_flash.global_transform = Transform3D(Basis.from_scale(Vector3.ONE * f["scale"]), origin)
		_flash_material.albedo_color.a = f["opacity"]
	else:
		_points.visible = false
		_flash.visible = false

func _jaw(upper: bool) -> Node3D:
	var jaw := Node3D.new()
	jaw.name = "UpperJaw" if upper else "LowerJaw"
	_jaw_root.add_child(jaw)
	var material := ShaderMaterial.new()
	material.shader = TOOTH_SHADER
	material.set_shader_parameter("color", RageJaws.COLOR)
	for i in RageJaws.TEETH:
		var spec := RageJaws.tooth(upper, i)
		var half_width: float = spec["half_width"]
		var triangle := PackedVector3Array([Vector3(-half_width, 0, 0), Vector3(half_width, 0, 0),
			Vector3(0, spec["length"], 0)])
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = triangle
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var tooth := MeshInstance3D.new()
		tooth.mesh = mesh
		tooth.material_override = material
		tooth.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		tooth.position = spec["position"]
		tooth.rotation.y = spec["yaw"]
		jaw.add_child(tooth)
		_teeth.append(tooth)
	return jaw

func _build_vortex() -> void:
	_points_mesh = ArrayMesh.new()   # rebuilt every charging frame: web Points over a dynamic position attribute
	_points = MeshInstance3D.new()
	_points.mesh = _points_mesh
	_points_material = ShaderMaterial.new()
	_points_material.shader = POINTS_SHADER
	_points_material.set_shader_parameter("color", SingularityVortex.COLOR)
	_points_material.set_shader_parameter("size", SingularityVortex.SIZE)
	_points.material_override = _points_material
	_points.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_points)
	var sphere := SphereMesh.new()
	sphere.radius = MoveConst.BALL_RADIUS
	sphere.height = MoveConst.BALL_RADIUS * DIAMETER
	sphere.radial_segments = SingularityVortex.FLASH_SEGMENTS
	sphere.rings = SingularityVortex.FLASH_SEGMENTS
	_flash = MeshInstance3D.new()
	_flash.mesh = sphere
	_flash_material = _additive(SingularityVortex.FLASH_COLOR)
	_flash.material_override = _flash_material
	_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_flash)

func _additive(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(color, 0.0)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return material
