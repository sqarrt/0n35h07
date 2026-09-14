class_name FinaleScene extends Control
## The trailer finale — port of web components/trailer/FinaleScene in its FinaleView canvas: two fighters with different
## looks (a cyan planet charging rage, a pink waves ball charging singularity) face each other from the sides, charge in
## slow motion and fire, and time nearly stops with both beams hanging in flight while the camera pulls back
## (FinaleTimeline). Lit by an ambient and a directional light, cleared to #04050a, and bloomed like the web HalfFloat
## composer (Bloom 1.2, threshold 0.2, smoothing 0.6, radius 0.7, mipmap blur): a float world viewport inside a
## BloomChain, screen-blended with its bloom and encoded on screen.

signal sound(event: String)
signal ended

const COMPOSITE_SHADER := preload("res://assets/shaders/menu_backdrop_composite.gdshader")   # lit: scene SCREEN bloom
const CLEAR_COLOR := Color("#04050a")          # web FinaleView setClearColor
const FOV := 55.0                              # web FinaleView camera fov
const AMBIENT_INTENSITY := 0.5                 # web ambientLight
const SUN_INTENSITY := 1.1                     # web directionalLight
const SUN_POSITION := Vector3(4.0, 8.0, 6.0)
const BLOOM_INTENSITY := 1.2
const BLOOM_THRESHOLD := 0.2
const BLOOM_SMOOTHING := 0.6
const BLOOM_RADIUS := 0.7
## web A / B: colour, ring, model and windup (beam) style differ; x places them on the sides.
const FIGHTERS := [
	{"color": "#4ff", "ring": "#fa4", "model": "planet", "windup": "rage", "x": -6.5},
	{"color": "#f4a", "ring": "#4ff", "model": "waves", "windup": "singularity", "x": 6.5},
]
const NO_SHRINK := 1.0                         # web windupFrame.shrink = 1: no deflate
const HOLD_STEP_S := 1.0 / 60.0                # parity frames: the clock steps to the held moment at 60 Hz
const HOLD_EPS := 1e-9

var timeline := FinaleTimeline.new()

var _bloom: BloomChain
var _world: SubViewport
var _camera: Camera3D
var _view: TextureRect
var _sides: Array[Dictionary] = []             # [{ball, windup, beam, color, style, x}]
var _time_s := 0.0
var _hold_s := -1.0

func _ready() -> void:
	name = "Finale"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_bloom = BloomChain.new(BLOOM_THRESHOLD, BLOOM_SMOOTHING, BLOOM_RADIUS)
	add_child(_bloom)
	_world = SubViewport.new()
	_world.name = "World"
	_world.own_world_3d = true
	_world.msaa_3d = Viewport.MSAA_4X
	_world.use_hdr_2d = true                   # linear float like the web HalfFloat composer: bright beams bloom
	_world.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_bloom.adopt(_world)
	_bloom.set_source(_world.get_texture())
	_bloom.set_active(true)
	_world.add_child(_environment())
	_world.add_child(_sun())
	_camera = Camera3D.new()
	_camera.name = "Camera"
	_camera.fov = FOV
	_world.add_child(_camera)
	_camera.current = true
	for fighter in FIGHTERS:
		_add_side(fighter)
	_add_view()
	resized.connect(_fit)
	_fit()
	_place_camera()
	if _hold_s >= 0.0:
		_run_to(_hold_s)

## Parity frames (web __debugFinaleHoldS): step at 60 Hz to `seconds` of real time and stay there.
func hold_at(seconds: float) -> void:
	_hold_s = seconds
	if is_node_ready():
		_run_to(seconds)

func _process(delta: float) -> void:
	if _hold_s < 0.0:
		advance(delta)

## One frame of the finale (web useFrame).
func advance(delta: float) -> void:
	var step := timeline.step(delta)
	var dt: float = step["dt"]
	if dt <= 0.0:
		return
	_time_s += dt
	_place_camera()
	for i in _sides.size():
		var side := _sides[i]
		var aim := (_center(_sides[1 - i]) - _center(side)).normalized()
		(side["ball"] as BallVisual).face_dir(aim)
		(side["ball"] as BallVisual).tick(dt)
	var charge: float = step["charge"]
	if charge >= 0.0:
		for i in _sides.size():
			_charge(_sides[i], _sides[1 - i], charge, dt)
		if step["fire"]:
			for i in _sides.size():
				_fire(_sides[i], _sides[1 - i], dt)
	else:
		for side in _sides:
			(side["beam"] as BeamFx).update_fx(step["beam_dt"])
	if step["ended"]:
		ended.emit()

func world() -> SubViewport:
	return _world

func camera() -> Camera3D:
	return _camera

func bloom() -> BloomChain:
	return _bloom

func view() -> TextureRect:
	return _view

func ball(index: int) -> BallVisual:
	return _sides[index]["ball"]

func beam(index: int) -> BeamFx:
	return _sides[index]["beam"]

func windup(index: int) -> WindupWorldView:
	return _sides[index]["windup"]

func _run_to(seconds: float) -> void:
	while timeline.real_s < seconds - HOLD_EPS and not timeline.ended:
		advance(HOLD_STEP_S)

## The windup skin on the ball and in the world, aimed at the opponent (web createWindupFx.apply).
func _charge(side: Dictionary, target: Dictionary, progress: float, dt: float) -> void:
	var look := SkinCurves.windup_ball(side["style"], progress, NO_SHRINK, side["color"], _time_s)
	var visual: BallVisual = side["ball"]
	visual.set_scale_factor(look["scale"])
	visual.set_color(look["color"])
	visual.set_emission(look["emission"])
	var origin := _center(side)
	(side["windup"] as WindupWorldView).apply(dt, progress, NO_SHRINK, origin, (_center(target) - origin).normalized(),
		true, _roll)

## The shot: a beam towards the opponent that stops BEAM_REACH of the way, rendered this frame, with its sound.
func _fire(side: Dictionary, target: Dictionary, dt: float) -> void:
	var origin := _center(side)
	var beam_fx: BeamFx = side["beam"]
	beam_fx.play(origin, origin.lerp(_center(target), FinaleTimeline.BEAM_REACH))
	beam_fx.update_fx(dt)
	sound.emit(DemoPlayback.BEAM_SOUNDS[side["style"]])

func _add_side(fighter: Dictionary) -> void:
	var color := Color(fighter["color"])
	var visual := BallVisual.new()
	visual.name = "Ball_%s" % fighter["windup"]
	visual.position = Vector3(fighter["x"], FinaleTimeline.CENTER_Y, 0.0)
	_world.add_child(visual)
	visual.setup(color, fighter["model"], Color(fighter["ring"]))
	visual.set_opacity(1.0)
	var windup_view := WindupWorldView.new()
	_world.add_child(windup_view)
	windup_view.setup(fighter["windup"], _roll)
	var beam_fx := BeamFx.new()
	_world.add_child(beam_fx)
	beam_fx.setup(fighter["windup"], color)
	_sides.append({"ball": visual, "windup": windup_view, "beam": beam_fx, "color": color, "style": fighter["windup"],
		"x": float(fighter["x"])})

func _center(side: Dictionary) -> Vector3:
	return Vector3(side["x"], FinaleTimeline.CENTER_Y, 0.0)

func _place_camera() -> void:
	_camera.position = Vector3(0.0, FinaleTimeline.CAM_HEIGHT, timeline.camera_z())
	_camera.look_at(Vector3(0.0, FinaleTimeline.CENTER_Y, 0.0))

func _environment() -> WorldEnvironment:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color.WHITE
	env.ambient_light_energy = AMBIENT_INTENSITY / PI   # three.js lights are divided by π in Godot (MapLights)
	env.tonemap_mode = MapLights.TONEMAPPER
	var node := WorldEnvironment.new()
	node.name = "Environment"
	node.environment = env
	return node

func _sun() -> DirectionalLight3D:
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_energy = SUN_INTENSITY / PI
	sun.shadow_enabled = false                 # web FinaleView's Canvas has no `shadows`
	sun.transform = Transform3D(Basis.looking_at(-SUN_POSITION.normalized(), Vector3.UP), SUN_POSITION)
	return sun

## The world on screen: screen-blended with its bloom, linear light encoded (the menu backdrop's lit composite).
func _add_view() -> void:
	_view = TextureRect.new()
	_view.name = "View"
	_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_view.stretch_mode = TextureRect.STRETCH_SCALE
	_view.texture = _world.get_texture()
	var composite := ShaderMaterial.new()
	composite.shader = COMPOSITE_SHADER
	composite.set_shader_parameter("lit", true)
	composite.set_shader_parameter("edge", _world.get_texture())
	composite.set_shader_parameter("bloom", _bloom.texture())
	composite.set_shader_parameter("bloom_intensity", BLOOM_INTENSITY)
	_view.material = composite
	add_child(_view)
	_view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

func _fit() -> void:
	var pixels := Vector2i(maxi(roundi(size.x), 1), maxi(roundi(size.y), 1))
	_world.size = pixels
	_bloom.set_size(pixels)

## web Math.random for the windup skins.
func _roll() -> float:
	return randf()
