class_name MenuBackdrop extends SubViewportContainer
## Persistent 3D backdrop of the menu screens — port of web components/MenuBackdrop: its own transparent 3D world under
## the menu panel, framed only by the camera (MenuCameraRig poses, damped), lit by a 0.4 ambient and a directional
## light slowly orbiting the stage, with the stage's balls (MenuStage: you, or every lobby seat on its spot) as the
## in-game BallVisual at full size, facing the camera: held through the warm-up and fading in, leaving balls
## shrinking out (MenuStageBall), colours easing (web COLOR_TAU). three.js lights are divided by π like MapLights.

const FOV := 45.0                                   # web Canvas camera fov (vertical)
const AMBIENT_INTENSITY := 0.4                      # web <ambientLight intensity={0.4} />
const LIGHT_POSITION := Vector3(10.0, 10.0, 5.0)    # web <directionalLight position={[10, 10, 5]} />, aimed at the origin
const LIGHT_INTENSITY := 1.0
const SPIN_SPEED := 0.6                             # web PREVIEW_SPIN_SPEED (rad/s): the light's orbit
const COLOR_TAU := 0.067                            # web COLOR_TAU: a ball's colour change eases in ~0.2 s
const EXIT_MS := 400.0                              # web EXIT_MS: a leaving ball stays mounted while it fades
const PREMULTIPLIED_SHADER := preload("res://assets/shaders/premultiplied_viewport.gdshader")   # web canvas alpha

## One ball on the stage: its visual, its appearance state and where it stands.
class StageEntry:
	var visual: BallVisual
	var stage: MenuStageBall
	var spec := {}
	var color := Color.WHITE
	var exiting := false
	var exit_ms := 0.0

var rig: MenuCameraRig

var _viewport: SubViewport
var _camera: Camera3D
var _light_pivot: Node3D
var _light: DirectionalLight3D
var _entries := {}                                  # key -> StageEntry
var _warm_frames := 0
var _light_angle := 0.0
var _light_pinned := false
var _ball_time := 0.0
var _ball_time_pinned := false

func _ready() -> void:
	name = "Backdrop"
	stretch = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var composite := ShaderMaterial.new()
	composite.shader = PREMULTIPLIED_SHADER
	material = composite
	_viewport = SubViewport.new()
	_viewport.name = "World"
	_viewport.transparent_bg = true
	_viewport.own_world_3d = true
	_viewport.msaa_3d = Viewport.MSAA_4X
	add_child(_viewport)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color.WHITE
	env.ambient_light_energy = AMBIENT_INTENSITY / PI
	env.tonemap_mode = MapLights.TONEMAPPER
	environment.environment = env
	_viewport.add_child(environment)
	rig = MenuCameraRig.new(MenuCameraRig.load_poses(MenuCameraRig.POSES_PATH))
	_camera = Camera3D.new()
	_camera.name = "Camera"
	_camera.fov = FOV
	_viewport.add_child(_camera)
	_place_camera()
	_light_pivot = Node3D.new()
	_light_pivot.name = "LightOrbit"
	_viewport.add_child(_light_pivot)
	_light = DirectionalLight3D.new()
	_light.name = "Light"
	_light.light_energy = LIGHT_INTENSITY / PI
	_light_pivot.add_child(_light)
	_light.look_at_from_position(LIGHT_POSITION, Vector3.ZERO)
	set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))

## The camera pose for a screen (web cameraStateFor): menu / settings — default; lobby — the Duel pair or the square.
func set_screen(screen: String, game_mode := GameModes.DUEL, is_client := false) -> void:
	rig.set_state(MenuCameraRig.state_for(screen, game_mode, is_client))

## The stage's balls ([{key, spec, spot}], MenuStage.balls): new keys fade in, missing keys shrink out.
func set_balls(balls: Array) -> void:
	var active := {}
	for ball in balls:
		var key: String = ball["key"]
		active[key] = true
		var entry: StageEntry = _entries.get(key)
		if entry == null:
			entry = _new_entry(key, ball["spec"])
			_entries[key] = entry
		elif entry.spec.get("model") != ball["spec"]["model"] or entry.spec.get("art") != ball["spec"]["art"]:
			entry.visual.setup(entry.color, ball["spec"]["model"], Color(ball["spec"]["ring"]), ball["spec"]["art"])
		entry.spec = ball["spec"]
		entry.exiting = false
		entry.exit_ms = 0.0
		entry.visual.position = (ball["spot"] as Vector3) + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
	for key in _entries:
		if not active.has(key):
			(_entries[key] as StageEntry).exiting = true

## Parity captures: pin the orbiting light at `angle` radians (web __debugMenuLightAngle).
func set_light_angle(angle: float) -> void:
	_light_angle = angle
	_light_pinned = true
	_light_pivot.rotation.y = angle

## Parity captures: pin every ball's shader clock at `seconds` (web __debugMenuBallTime).
func pin_ball_time(seconds: float) -> void:
	_ball_time = seconds
	_ball_time_pinned = true

## Your own ball (the "player" key).
func ball() -> BallVisual:
	return ball_for(MenuStage.PLAYER_KEY)

func ball_for(key: String) -> BallVisual:
	var entry: StageEntry = _entries.get(key)
	return entry.visual if entry != null else null

func stage() -> MenuStageBall:
	return stage_for(MenuStage.PLAYER_KEY)

func stage_for(key: String) -> MenuStageBall:
	var entry: StageEntry = _entries.get(key)
	return entry.stage if entry != null else null

func camera() -> Camera3D:
	return _camera

func light() -> DirectionalLight3D:
	return _light

func _process(delta: float) -> void:
	_warm_frames += 1
	rig.step(delta)
	_place_camera()
	if not _light_pinned:
		_light_angle += SPIN_SPEED * minf(delta, MenuCameraRig.MAX_DT)
	_light_pivot.rotation.y = _light_angle
	var color_k := 1.0 - exp(-minf(delta, MenuCameraRig.MAX_DT) / COLOR_TAU)
	for key in _entries.keys():
		var entry: StageEntry = _entries[key]
		if entry.exiting:
			entry.exit_ms += delta * MenuStageBall.MS_PER_S
			if entry.exit_ms >= EXIT_MS:
				entry.visual.queue_free()
				_entries.erase(key)
				continue
		entry.stage.step(delta, entry.exiting)
		entry.color = entry.color.lerp(Color(entry.spec["color"]), color_k)
		entry.visual.set_color(entry.color)
		entry.visual.set_opacity(entry.stage.opacity)
		entry.visual.set_scale_factor(entry.stage.scale)
		entry.visual.face_dir((_camera.global_position - entry.visual.global_position).normalized())   # facing you
		if _ball_time_pinned:
			entry.visual.set_time(_ball_time)
		else:
			entry.visual.tick(delta)

func _new_entry(key: String, spec: Dictionary) -> StageEntry:
	var entry := StageEntry.new()
	entry.spec = spec
	entry.color = Color(spec["color"])
	entry.stage = MenuStageBall.new(maxi(MenuStageBall.WARMUP_FRAMES - _warm_frames, 0))
	entry.visual = BallVisual.new()
	entry.visual.name = "Ball_%s" % key
	_viewport.add_child(entry.visual)
	entry.visual.setup(entry.color, spec["model"], Color(spec["ring"]), spec["art"])
	entry.visual.set_opacity(0.0)
	return entry

func _place_camera() -> void:
	_camera.position = rig.position
	_camera.look_at(rig.look)
