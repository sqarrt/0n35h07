class_name MenuBackdrop extends SubViewportContainer
## Persistent 3D backdrop of the menu screens — port of web components/MenuBackdrop: its own transparent 3D world under
## the menu panel, framed only by the camera (MenuCameraRig poses, damped), lit by a 0.4 ambient and a directional
## light slowly orbiting the stage, with the player's ball (the in-game BallVisual, full size) standing on its spot,
## facing the camera and fading in after the warm-up (MenuStageBall). three.js lights are divided by π like MapLights.

const FOV := 45.0                                   # web Canvas camera fov (vertical)
const AMBIENT_INTENSITY := 0.4                      # web <ambientLight intensity={0.4} />
const LIGHT_POSITION := Vector3(10.0, 10.0, 5.0)    # web <directionalLight position={[10, 10, 5]} />, aimed at the origin
const LIGHT_INTENSITY := 1.0
const SPIN_SPEED := 0.6                             # web PREVIEW_SPIN_SPEED (rad/s): the light's orbit
const EYE_HEIGHT := 1.7                             # web EYE_HEIGHT
const PLAYER_SPOT := Vector3(0.0, EYE_HEIGHT, 0.0)  # web STAGE_SPOTS[0] (eye position)

var rig: MenuCameraRig

var _viewport: SubViewport
var _camera: Camera3D
var _light_pivot: Node3D
var _light: DirectionalLight3D
var _ball: BallVisual
var _stage := MenuStageBall.new()
var _light_angle := 0.0
var _light_pinned := false

func _ready() -> void:
	name = "Backdrop"
	stretch = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
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
	_light.position = LIGHT_POSITION
	_light.look_at_from_position(LIGHT_POSITION, Vector3.ZERO)
	_ball = BallVisual.new()
	_ball.name = "PlayerBall"
	_viewport.add_child(_ball)
	_ball.position = PLAYER_SPOT + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
	var profile: Dictionary = Game.profile
	var color := Color(profile.get("primaryColor", AppearanceConst.FALLBACK_EFFECT_COLOR))
	_ball.setup(color, profile.get("ballModel", AppearanceConst.BALL_MODELS[0]),
		Color(profile.get("reserveColor", profile.get("primaryColor", AppearanceConst.FALLBACK_EFFECT_COLOR))),
		profile.get("ballArt", ""))
	_ball.set_opacity(0.0)

## The camera pose for a screen (web cameraStateFor): menu / settings — default; lobby — the Duel pair or the square.
func set_screen(screen: String, game_mode := GameModes.DUEL, is_client := false) -> void:
	rig.set_state(MenuCameraRig.state_for(screen, game_mode, is_client))

## Parity captures: pin the orbiting light at `angle` radians (web __debugMenuLightAngle).
func set_light_angle(angle: float) -> void:
	_light_angle = angle
	_light_pinned = true
	_light_pivot.rotation.y = angle

func ball() -> BallVisual:
	return _ball

func camera() -> Camera3D:
	return _camera

func light() -> DirectionalLight3D:
	return _light

func stage() -> MenuStageBall:
	return _stage

func _process(delta: float) -> void:
	rig.step(delta)
	_place_camera()
	if not _light_pinned:
		_light_angle += SPIN_SPEED * minf(delta, MenuCameraRig.MAX_DT)
	_light_pivot.rotation.y = _light_angle
	_stage.step(delta, false)
	_ball.set_opacity(_stage.opacity)
	_ball.set_scale_factor(_stage.scale)
	_ball.face_dir((_camera.global_position - _ball.global_position).normalized())   # web: facing the viewer
	_ball.tick(delta)

func _place_camera() -> void:
	_camera.position = rig.position
	_camera.look_at(rig.look)
