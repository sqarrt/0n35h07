class_name BeamFx extends Node3D
## Shot beam skins — ports of web ClassicBeamFx (white core + player-coloured shell shrinking over the beam life, then a
## fading afterglow), RageBeamFx (white core + seven rattling segments, thickness pulse, stepped fade) and
## SingularityBeamFx (dark thread + faint shell + a particle spiral retracting into the muzzle); plus the BeamWeapon
## impact particles (six yellow spheres). Bots fire the classic beam with a red shell (web Match).

const STYLE_CLASSIC := "classic"
const STYLE_RAGE := "rage"
const STYLE_SINGULARITY := "singularity"
const DEFAULT_SHELL := Color("#0ff")        # web BeamWeapon default outerColor
const CORE_COLOR := Color.WHITE
const IMPACT_COLOR := Color("#ff0")
const IMPACT_SEGMENTS := 4                   # web SphereGeometry(1, 4, 4)
const IMPACT_RADIUS := 1.0
const HALF := 0.5
const DIAMETER := 2.0
const FIELD_OF_VIEW_DEG := 75.0              # PointsMaterial size attenuation at the default FOV
const MIN_LENGTH := 1e-6
const ANTIPARALLEL := -0.9999

var _style := STYLE_CLASSIC
var _shell_color := DEFAULT_SHELL
var _active := false
var _elapsed_ms := 0.0
var _time_s := 0.0
var _start := Vector3.ZERO
var _end := Vector3.ZERO
var _direction := Vector3.FORWARD
var _length := 0.0
var _side1 := Vector3.RIGHT
var _side2 := Vector3.UP
var _afterglow := 0.0
var _jitter_timer_ms := 0.0
var _offsets: Array[Vector2] = []
var _style_root: Node3D
var _core: MeshInstance3D
var _shell: MeshInstance3D
var _afterglow_mesh: MeshInstance3D
var _segments: Array[MeshInstance3D] = []
var _spiral: MultiMeshInstance3D
var _particles: Array = []   # [{mesh, vel, life}]

func _ready() -> void:
	var impact_mesh := SphereMesh.new()
	impact_mesh.radius = IMPACT_RADIUS
	impact_mesh.height = IMPACT_RADIUS * DIAMETER
	impact_mesh.radial_segments = IMPACT_SEGMENTS
	impact_mesh.rings = IMPACT_SEGMENTS
	var impact_material := _material(IMPACT_COLOR, 1.0, false)
	for i in range(CombatConst.IMPACT_PARTICLES):
		var m := MeshInstance3D.new()
		m.mesh = impact_mesh
		m.material_override = impact_material
		m.visible = false
		add_child(m)
		_particles.append({"mesh": m, "vel": Vector3.ZERO, "life": 0.0})
	setup(_style, _shell_color)

## Beam shape by the windup style and the shell colour (the player colour; bots: red).
func setup(style: String, shell_color: Color) -> void:
	_style = style if style in [STYLE_RAGE, STYLE_SINGULARITY] else STYLE_CLASSIC
	_shell_color = shell_color
	if not is_inside_tree() and _particles.is_empty():
		return   # _ready builds it
	if _style_root != null:
		remove_child(_style_root)
		_style_root.free()
	_segments.clear()
	_offsets.clear()
	_core = null
	_shell = null
	_afterglow_mesh = null
	_spiral = null
	_style_root = Node3D.new()
	_style_root.name = "Beam"
	add_child(_style_root)
	match _style:
		STYLE_RAGE:
			_core = _cylinder(BeamCurves.RAGE_CORE_RADIUS, BeamCurves.CYL_SEGMENTS_STYLED, CORE_COLOR, 1.0, true)
			for i in BeamCurves.RAGE_SEGMENTS:
				_segments.append(_cylinder(BeamCurves.RAGE_SEG_RADIUS, BeamCurves.CYL_SEGMENTS_STYLED, _shell_color,
					BeamCurves.RAGE_SEG_OPACITY, true))
				_offsets.append(Vector2.ZERO)
		STYLE_SINGULARITY:
			_core = _cylinder(BeamCurves.SING_CORE_RADIUS, BeamCurves.CYL_SEGMENTS_STYLED, BeamCurves.SING_CORE_COLOR,
				BeamCurves.SING_CORE_OPACITY, false)
			_shell = _cylinder(BeamCurves.SING_SHELL_RADIUS, BeamCurves.CYL_SEGMENTS_STYLED, _shell_color,
				BeamCurves.SING_SHELL_OPACITY, true)
			_spiral = _spiral_points()
		_:
			_core = _cylinder(BeamCurves.CORE_RADIUS, BeamCurves.CYL_SEGMENTS_CLASSIC, CORE_COLOR, 1.0, false)
			_shell = _cylinder(BeamCurves.SHELL_RADIUS, BeamCurves.CYL_SEGMENTS_CLASSIC, _shell_color,
				BeamCurves.SHELL_OPACITY, true)
			_afterglow_mesh = _cylinder(BeamCurves.AFTERGLOW_RADIUS, BeamCurves.CYL_SEGMENTS_CLASSIC, _shell_color, 0.0, true)
	_hide_beam()

func style() -> String:
	return _style

func play(start: Vector3, end: Vector3) -> void:
	_start = start
	_end = end
	var delta := end - start
	_length = delta.length()
	if _length < MIN_LENGTH:
		return
	_direction = delta / _length
	var axes := BeamCurves.side_axes(_direction)
	_side1 = axes[0]
	_side2 = axes[1]
	_active = true
	_elapsed_ms = 0.0
	_afterglow = BeamCurves.AFTERGLOW_INITIAL
	_jitter_timer_ms = 0.0
	update_fx(0.0)   # web: BeamWeapon.update fires and renders the beam in the same tick

func spawn_impact(point: Vector3) -> void:
	for p in _particles:
		p["mesh"].global_position = point
		p["vel"] = Vector3(
			(randf() - HALF) * CombatConst.IMPACT_SPREAD_H,
			randf() * CombatConst.IMPACT_SPREAD_V,
			(randf() - HALF) * CombatConst.IMPACT_SPREAD_H)
		p["life"] = 1.0
		p["mesh"].visible = true

func update_fx(dt: float) -> void:
	_time_s += dt
	match _style:
		STYLE_RAGE:
			_update_rage(dt)
		STYLE_SINGULARITY:
			_update_singularity(dt)
		_:
			_update_classic(dt)
	_update_particles(dt)

func is_beam_visible() -> bool:
	return _core != null and _core.visible

func afterglow_visible() -> bool:
	return _afterglow_mesh != null and _afterglow_mesh.visible

func core() -> MeshInstance3D:
	return _core

func segments() -> Array[MeshInstance3D]:
	return _segments

func spiral() -> MultiMeshInstance3D:
	return _spiral

func alive_particles() -> int:
	var n := 0
	for p in _particles:
		if p["life"] > 0.0:
			n += 1
	return n

## Beam life share, or -1 once the beam is over (it hides then).
func _advance_life(dt: float) -> float:
	if not _active:
		return -1.0
	_elapsed_ms += dt * SkinCurves.MS_PER_S
	var t := minf(_elapsed_ms / CombatConst.BEAM_DURATION_MS, 1.0)
	if t >= 1.0:
		_active = false
		_hide_beam()
		return -1.0
	return t

func _update_classic(dt: float) -> void:
	var t := _advance_life(dt)
	if t >= 0.0:
		var width := BeamCurves.classic_width(t)
		for mesh in [_core, _shell]:
			_place(mesh, _start.lerp(_end, HALF), Vector3(width, _length, width))
	if _afterglow <= 0.0:
		_afterglow_mesh.visible = false
		return
	_afterglow = BeamCurves.afterglow_step(_afterglow, dt)
	if _afterglow <= 0.0:
		_afterglow_mesh.visible = false
		return
	_place(_afterglow_mesh, _start.lerp(_end, HALF), Vector3(1.0, _length, 1.0))
	_set_alpha(_afterglow_mesh, BeamCurves.afterglow_opacity(_afterglow))

func _update_rage(dt: float) -> void:
	var t := _advance_life(dt)
	if t < 0.0:
		return
	_jitter_timer_ms -= dt * SkinCurves.MS_PER_S
	if _jitter_timer_ms <= 0.0:
		_jitter_timer_ms = BeamCurves.RAGE_JITTER_INTERVAL_MS
		for i in _offsets.size():
			_offsets[i] = Vector2((randf() - HALF) * DIAMETER * BeamCurves.RAGE_JITTER_MAX,
				(randf() - HALF) * DIAMETER * BeamCurves.RAGE_JITTER_MAX)
	var level := BeamCurves.rage_level(t)
	var pulse := BeamCurves.rage_pulse(_time_s)
	_set_alpha(_core, level)
	_place(_core, _start.lerp(_end, HALF), Vector3(pulse, _length, pulse))
	var segment_length := BeamCurves.rage_segment_length(_length)
	for i in _segments.size():
		_set_alpha(_segments[i], BeamCurves.RAGE_SEG_OPACITY * level)
		var center := BeamCurves.rage_segment_center(_start, _end, i) + _side1 * _offsets[i].x + _side2 * _offsets[i].y
		_place(_segments[i], center, Vector3(pulse, segment_length, pulse))

func _update_singularity(dt: float) -> void:
	var t := _advance_life(dt)
	if t < 0.0:
		return
	var retract := BeamCurves.singularity_retract(t)
	var visible_length := _length * (1.0 - retract)
	var center := _start + _direction * visible_length * HALF
	_place(_core, center, Vector3(1.0, visible_length, 1.0))
	_place(_shell, center, Vector3(1.0, visible_length, 1.0))
	var phase := fposmod(_time_s * BeamCurves.SING_PHASE_SPEED, 1.0)
	var radius := BeamCurves.spiral_radius(t)
	var multimesh := _spiral.multimesh
	for i in multimesh.instance_count:
		var point := BeamCurves.spiral_point(i, phase, visible_length, radius, _start, _direction, _side1, _side2)
		multimesh.set_instance_transform(i, Transform3D(Basis.IDENTITY, point))
	_set_alpha(_spiral, BeamCurves.SING_SPIRAL_OPACITY * (1.0 - retract))
	_spiral.visible = true

func _update_particles(dt: float) -> void:
	for p in _particles:
		if p["life"] <= 0.0:
			p["mesh"].visible = false
			continue
		p["mesh"].global_position += p["vel"] * dt
		p["vel"].y += MoveConst.GRAVITY * dt
		p["life"] -= dt * CombatConst.IMPACT_LIFE_DECAY
		var sc: float = maxf(0.0, p["life"]) * CombatConst.IMPACT_SCALE
		p["mesh"].scale = Vector3(sc, sc, sc)
		p["mesh"].visible = p["life"] > 0.0

## Orient a unit cylinder (height along +Y) from `center` along the beam, scaled (radius x, length, radius z).
func _place(mesh: MeshInstance3D, center: Vector3, scale_xyz: Vector3) -> void:
	var rotation_basis := Basis(Vector3.RIGHT, PI) if _direction.dot(Vector3.UP) < ANTIPARALLEL \
		else Basis(Quaternion(Vector3.UP, _direction))
	mesh.global_transform = Transform3D(rotation_basis * Basis.from_scale(scale_xyz), center)
	mesh.visible = true

func _hide_beam() -> void:
	for node in [_core, _shell, _spiral]:
		if node != null:
			node.visible = false
	for segment in _segments:
		segment.visible = false
	if _afterglow_mesh != null and _afterglow <= 0.0:
		_afterglow_mesh.visible = false

func _cylinder(radius: float, segments: int, color: Color, alpha: float, additive: bool) -> MeshInstance3D:
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = radius
	cylinder.bottom_radius = radius
	cylinder.height = 1.0
	cylinder.radial_segments = segments
	var mesh := MeshInstance3D.new()
	mesh.mesh = cylinder
	mesh.material_override = _material(color, alpha, additive)
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mesh.visible = false
	_style_root.add_child(mesh)
	return mesh

## Square additive sprites like three.js Points: world size = PointsMaterial size × tan(fov / 2).
func _spiral_points() -> MultiMeshInstance3D:
	var quad := QuadMesh.new()
	var side := BeamCurves.SING_SPIRAL_SIZE * tan(deg_to_rad(FIELD_OF_VIEW_DEG) * HALF)
	quad.size = Vector2(side, side)
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D   # must precede instance_count (default is 2D)
	multimesh.mesh = quad
	multimesh.instance_count = BeamCurves.SING_SPIRAL_PARTICLES
	var node := MultiMeshInstance3D.new()
	node.multimesh = multimesh
	var material := _material(_shell_color, 0.0, true)
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	node.material_override = material
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.visible = false
	_style_root.add_child(node)
	return node

func _material(color: Color, alpha: float, additive: bool) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(color, alpha)
	if additive or alpha < 1.0:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	if additive:
		material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	return material

func _set_alpha(node: GeometryInstance3D, alpha: float) -> void:
	var material := node.material_override as StandardMaterial3D
	material.albedo_color.a = alpha
