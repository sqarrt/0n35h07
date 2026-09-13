class_name RespawnFxView extends Node3D
## Respawn skins — web createRespawnFx: "echo" (death burst, translucent ghost, springy poof), "chaos" (a jittering,
## flickering ghost and a stepped glitch reassembly) and "swarm" (the ball shatters into orbiting fragments that gather
## back). During the ghost phase and its own rebirth window the style owns the ball's scale, colour, opacity, offset and
## visibility; the first frame outside restores neutral. Echo and chaos draw their own classic ghost trail.

const STYLE_ECHO := "echo"
const STYLE_CHAOS := "chaos"
const STYLE_SWARM := "swarm"
const CLONE_SHADER := preload("res://assets/shaders/additive_particle.gdshader")
const TETRA_CORNERS: Array[Vector3] = [Vector3(1, 1, 1), Vector3(-1, -1, 1), Vector3(-1, 1, -1), Vector3(1, -1, -1)]
const TETRA_FACES: Array[int] = [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1]   # three TetrahedronGeometry, counter-clockwise
const TRIANGLE := 3

## One frame of the respawn state (web RespawnFrame).
class Frame extends RefCounted:
	var ghost := false
	var ghost_left := 0.0          # ghost phase remainder 1 -> 0
	var since_rebirth_ms := INF
	var origin := Vector3.ZERO     # ball centre
	var eye := Vector3.ZERO        # body position: the ghost trail anchor
	var base_color := Color.WHITE
	var shown := true              # false for your own first-person body

var _style := STYLE_ECHO
var _burst: DeathBurst
var _burst_view: ParticleView
var _ghost_trail: AfterimageTrail
var _ghost_trail_view: ParticleView
var _chaos: ChaosRespawn
var _swarm: SwarmRespawn
var _swarm_root: Node3D
var _fragments: Array[MeshInstance3D] = []
var _clones: Array[MeshInstance3D] = []
var _dirty := false

## Build a respawn style in the player colour (unknown styles fall back to echo, web createRespawnFx).
func setup(style: String, color: Color, rng: Callable) -> void:
	top_level = true
	transform = Transform3D.IDENTITY   # turning top_level on in the tree keeps the player's offset otherwise
	for child in get_children():
		remove_child(child)
		child.free()
	_fragments.clear()
	_clones.clear()
	_burst = null
	_burst_view = null
	_ghost_trail = null
	_ghost_trail_view = null
	_chaos = null
	_swarm = null
	_dirty = false
	_style = style if style in [STYLE_CHAOS, STYLE_SWARM] else STYLE_ECHO
	match _style:
		STYLE_ECHO:
			_burst = DeathBurst.new(color)
			_burst_view = _particle_view("DeathBurst", _burst.pool, SkinCurves.DEATH_BURST_RADIUS, color)
		STYLE_CHAOS:
			_chaos = ChaosRespawn.new()
		STYLE_SWARM:
			_swarm = SwarmRespawn.new(rng)
			_build_swarm(color)
	if _style != STYLE_SWARM:   # the swarm fragments draw their own trail
		_ghost_trail = AfterimageTrail.new(color)
		_ghost_trail_view = _particle_view("GhostTrail", _ghost_trail.pool, SkinCurves.DASH_TRAIL_RADIUS, color)

func style() -> String:
	return _style

func burst_view() -> ParticleView:
	return _burst_view

func ghost_trail_view() -> ParticleView:
	return _ghost_trail_view

func fragments_visible_count() -> int:
	return _fragments.filter(func(m: MeshInstance3D) -> bool: return m.is_visible_in_tree()).size()

func clones_visible_count() -> int:
	return _clones.filter(func(m: MeshInstance3D) -> bool: return m.is_visible_in_tree()).size()

## The moment of death (only for a visible body, web Player.startGhost).
func on_death(origin: Vector3, rng: Callable) -> void:
	match _style:
		STYLE_ECHO:
			_burst.emit(origin, rng)
		STYLE_CHAOS:
			_chaos.on_death()
		STYLE_SWARM:
			_swarm.on_death(origin, rng)

## Is the style's rebirth window still open? (the shield stays hidden during it)
func is_rebirth_active(since_rebirth_ms: float) -> bool:
	match _style:
		STYLE_CHAOS:
			return ChaosRespawn.is_rebirth(since_rebirth_ms)
		STYLE_SWARM:
			return SwarmRespawn.is_rebirth(since_rebirth_ms)
	return SkinCurves.is_echo_rebirth(since_rebirth_ms)

## web IRespawnFx.apply: after the windup, so the rebirth window beats its scale.
func apply(dt: float, ball: BallVisual, f: Frame, rng: Callable) -> void:
	if _ghost_trail != null:
		_ghost_trail.update(dt, f.ghost and f.shown, f.eye)
		_ghost_trail_view.refresh()
	match _style:
		STYLE_CHAOS:
			_apply_chaos(dt, ball, f, rng)
		STYLE_SWARM:
			_apply_swarm(dt, ball, f, rng)
		_:
			_apply_echo(ball, f)

## web IRespawnFx.update: particles keep fading outside the phases.
func update(dt: float) -> void:
	if _burst != null:
		_burst.update(dt)
		_burst_view.refresh()
	if _swarm != null:
		_swarm.update_trail(dt)
		_refresh_clones()

func _apply_echo(ball: BallVisual, f: Frame) -> void:
	var look := SkinCurves.echo_respawn(f.ghost, f.since_rebirth_ms)
	if not look["active"]:
		return
	ball.set_scale_factor(look["scale"])
	ball.set_opacity(look["opacity"])
	ball.set_color(f.base_color)

func _apply_chaos(dt: float, ball: BallVisual, f: Frame, rng: Callable) -> void:
	var frame: Dictionary
	if f.ghost:
		frame = _chaos.ghost_frame(dt, f.ghost_left, rng)
		ball.set_scale_factor(1.0)
	elif ChaosRespawn.is_rebirth(f.since_rebirth_ms):
		frame = _chaos.rebirth_frame(f.since_rebirth_ms)
	else:
		if _dirty:
			_restore(ball)
		return
	ball.set_mesh_offset(frame["offset"])
	ball.set_opacity(frame["opacity"])
	ball.set_color(f.base_color)
	_dirty = true

func _apply_swarm(dt: float, ball: BallVisual, f: Frame, rng: Callable) -> void:
	_swarm.advance(dt)
	if f.ghost:
		_swarm.ghost_step(dt, f.origin, rng)
		ball.set_mesh_visible(false)
		_swarm_root.visible = f.shown
		_dirty = true
	elif SwarmRespawn.is_rebirth(f.since_rebirth_ms):
		var scale_factor := _swarm.rebirth_step(f.since_rebirth_ms, f.origin)
		_swarm_root.visible = f.shown and _swarm.world_visible
		ball.set_mesh_visible(true)
		ball.set_scale_factor(scale_factor)
		ball.set_opacity(1.0)
		ball.set_color(f.base_color)
		_dirty = true
	elif _dirty:
		_restore(ball)
		_swarm_root.visible = false
		_swarm.reset_neutral()
	if _swarm_root.visible:
		_refresh_fragments()

func _restore(ball: BallVisual) -> void:
	ball.set_mesh_offset(Vector3.ZERO)
	ball.set_mesh_visible(true)
	ball.set_opacity(1.0)
	_dirty = false

func _refresh_fragments() -> void:
	for i in _fragments.size():
		_fragments[i].global_transform = Transform3D(
			Basis.from_euler(_swarm.rotations[i], EULER_ORDER_XYZ), _swarm.positions[i])

func _refresh_clones() -> void:
	for i in _clones.size():
		var clone := _clones[i]
		clone.visible = _swarm.trail_alive(i)
		if not clone.visible:
			continue
		clone.global_transform = Transform3D(
			Basis.from_euler(_swarm.trail_rotations[i], EULER_ORDER_XYZ), _swarm.trail_positions[i])
		clone.set_instance_shader_parameter("opacity", _swarm.trail_opacity(i))

func _particle_view(node_name: String, pool: ParticlePool, radius: float, color: Color) -> ParticleView:
	var view := ParticleView.new()
	view.name = node_name
	add_child(view)
	view.setup(pool, radius, color)
	return view

func _build_swarm(color: Color) -> void:
	_swarm_root = Node3D.new()
	_swarm_root.name = "Swarm"
	_swarm_root.visible = false
	add_child(_swarm_root)
	var tetrahedron := _tetrahedron(SwarmRespawn.FRAG_SIZE)
	var solid := StandardMaterial3D.new()   # web MeshBasicMaterial({ color })
	solid.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	solid.albedo_color = color
	for i in SwarmRespawn.FRAGMENTS:
		_fragments.append(_fragment_mesh(tetrahedron, solid))
	var glow := ShaderMaterial.new()
	glow.shader = CLONE_SHADER
	glow.set_shader_parameter("color", color)
	for i in SwarmRespawn.TRAIL_CLONES:
		var clone := _fragment_mesh(tetrahedron, glow)
		clone.visible = false
		_clones.append(clone)

func _fragment_mesh(mesh: Mesh, material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_swarm_root.add_child(instance)
	return instance

## web TetrahedronGeometry(radius): four corners of a cube on the sphere; Godot's front faces wind clockwise.
static func _tetrahedron(radius: float) -> ArrayMesh:
	var vertices := PackedVector3Array()
	for face in TETRA_FACES.size() / TRIANGLE:
		for corner in range(TRIANGLE - 1, -1, -1):
			vertices.append(TETRA_CORNERS[TETRA_FACES[face * TRIANGLE + corner]].normalized() * radius)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh
