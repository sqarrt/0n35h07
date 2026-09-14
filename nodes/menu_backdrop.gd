class_name MenuBackdrop extends Control
## Persistent 3D backdrop of the menu screens — port of web components/MenuBackdrop: its own transparent 3D world under
## the menu panel, framed only by the camera (MenuCameraRig poses, damped), lit by a 0.4 ambient and a directional
## light slowly orbiting the stage, with the stage's balls (MenuStage: you, or every lobby seat on its spot) as the
## in-game BallVisual at full size, facing the camera: held through the warm-up and fading in, leaving balls
## shrinking out (MenuStageBall), colours easing (web COLOR_TAU). three.js lights are divided by π like MapLights.
## While there is sound the model edges glow (MenuEdgeGlow, brightness from MenuGlowLevel). The `View` shows it all,
## composited premultiplied like the web canvas.

const FOV := 45.0                                   # web Canvas camera fov (vertical)
const AMBIENT_INTENSITY := 0.4                      # web <ambientLight intensity={0.4} />
const LIGHT_POSITION := Vector3(10.0, 10.0, 5.0)    # web <directionalLight position={[10, 10, 5]} />, aimed at the origin
const LIGHT_INTENSITY := 1.0
const SPIN_SPEED := 0.6                             # web PREVIEW_SPIN_SPEED (rad/s): the light's orbit
const COLOR_TAU := 0.067                            # web COLOR_TAU: a ball's colour change eases in ~0.2 s
const EXIT_MS := 400.0                              # web EXIT_MS: a leaving ball stays mounted while it fades
const COMPOSITE_SHADER := preload("res://assets/shaders/menu_backdrop_composite.gdshader")
const PROFILE_MENU_GLOW := "menuGlow"
const SHOT_AIM := Vector3(-0.78, -0.55, 1.3)        # web SHOT_AIM_DIR (normalised where used)
const PAINT_AIM := Vector3(0.0, 0.0, 1.0)           # web: the art's front hemisphere faces +Z while painting

## One ball on the stage: its visual, its appearance state and where it stands.
class StageEntry:
	var visual: BallVisual
	var stage: MenuStageBall
	var spec := {}
	var color := Color.WHITE
	var exiting := false
	var exit_ms := 0.0
	var spot := Vector3.ZERO

var rig: MenuCameraRig
var glow_muted := false                             # web glowMuted: the appearance screen silences the edge glow

var _viewport: SubViewport
var _camera: Camera3D
var _light_pivot: Node3D
var _light: DirectionalLight3D
var _view: TextureRect
var _composite: ShaderMaterial
var _glow: MenuEdgeGlow
var _glow_level := MenuGlowLevel.new()
var _entries := {}                                  # key -> StageEntry
var _warm_frames := 0
var _light_angle := 0.0
var _light_pinned := false
var _ball_time := 0.0
var _ball_time_pinned := false
var _glow_input := 0.0
var _glow_input_pinned := false
var _appearance_part := ""
var _preview: MenuStagePreview
var _preview_hold_ms := MenuStagePreview.NO_HOLD

func _ready() -> void:
	name = "Backdrop"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glow = MenuEdgeGlow.new()
	add_child(_glow)
	_viewport = SubViewport.new()
	_viewport.name = "World"
	_viewport.transparent_bg = true
	_viewport.own_world_3d = true
	_viewport.msaa_3d = Viewport.MSAA_4X
	_viewport.use_hdr_2d = true   # linear float like the web HalfFloat composer: bright effects keep HDR for the bloom
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_glow.adopt_world(_viewport)
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
	_camera.cull_mask &= ~MenuEdgeGlow.GLOW_LAYERS
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
	_add_view()
	resized.connect(_fit)
	_fit()
	set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))

## The camera pose for a screen (web cameraStateFor): menu / settings — default; lobby — the Duel pair or the square.
func set_screen(screen: String, game_mode := GameModes.DUEL, is_client := false,
		part := MenuCameraRig.PART_COLOR) -> void:
	rig.set_state(MenuCameraRig.state_for(screen, game_mode, is_client, part))
	_appearance_part = part if screen == MenuCameraRig.SCREEN_APPEARANCE else ""
	if screen == MenuCameraRig.SCREEN_APPEARANCE and _preview == null:
		_preview = MenuStagePreview.new()
		_preview.hold_ms = _preview_hold_ms
		_viewport.add_child(_preview)
	elif screen != MenuCameraRig.SCREEN_APPEARANCE and _preview != null:
		_preview.queue_free()
		_preview = null
		_settle_own_ball()

## A style click on the appearance screen: its one-shot preview on your ball (web App handle*Preview seq counters).
func preview_style(kind: String, style: String) -> void:
	if _preview != null:
		_preview.trigger(kind, style)

## Parity captures: freeze the style previews this long after a click (web __debugPreviewHoldMs).
func pin_preview_hold_ms(ms: float) -> void:
	_preview_hold_ms = ms
	if _preview != null:
		_preview.hold_ms = ms

func preview() -> MenuStagePreview:
	return _preview

## Leaving the previews mid-run: your ball back on its spot, whole and without the windup glow (web rfx dispose).
func _settle_own_ball() -> void:
	var entry: StageEntry = _entries.get(MenuStage.PLAYER_KEY)
	if entry == null:
		return
	entry.visual.position = entry.spot + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
	entry.visual.set_emission(Color.BLACK)
	entry.visual.set_mesh_offset(Vector3.ZERO)
	entry.visual.set_mesh_visible(true)

## Where your ball looks (web StageBall on the appearance preview): its art side toward +Z while painting, the fixed
## diagonal of the SHOT block, otherwise at the camera.
func facing_of(key: String, visual: BallVisual) -> Vector3:
	if key == MenuStage.PLAYER_KEY:
		if _appearance_part in [MenuCameraRig.PART_PAINT_FRONT, MenuCameraRig.PART_PAINT_BACK]:
			return PAINT_AIM
		if _appearance_part == MenuCameraRig.PART_SHOT:
			return SHOT_AIM.normalized()
	return (_camera.global_position - visual.global_position).normalized()

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
			_glow.add_model(entry.visual)
		entry.spec = ball["spec"]
		entry.exiting = false
		entry.exit_ms = 0.0
		entry.spot = ball["spot"]
		entry.visual.position = entry.spot + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
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

## Parity captures: pin the audio level the edge glow reads (web __debugMenuGlowLevel).
func pin_glow_level(level: float) -> void:
	_glow_input = level
	_glow_input_pinned = true

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

func world() -> SubViewport:
	return _viewport

func view() -> TextureRect:
	return _view

func glow() -> MenuEdgeGlow:
	return _glow

func _process(delta: float) -> void:
	_warm_frames += 1
	rig.step(delta)
	_place_camera()
	_glow.sync_camera(_camera)
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
		entry.visual.face_dir(facing_of(key, entry.visual))
		if key == MenuStage.PLAYER_KEY and _preview != null:
			_preview.step(delta, entry.visual, entry.spot, entry.color, entry.stage.scale, entry.spec,
				facing_of(key, entry.visual))
		if _ball_time_pinned:
			entry.visual.set_time(_ball_time)
		else:
			entry.visual.tick(delta)
	_step_glow(delta)

## web MenuEdgeGlow useFrame: the level from the sound (muted with the profile's menu glow off) drives the edge
## intensity; the post chain renders only while that is visible.
func _step_glow(delta: float) -> void:
	var level := _glow_input if _glow_input_pinned else Audio.analysis.level()
	_glow_level.step(delta, level, glow_muted or not bool(Game.profile.get(PROFILE_MENU_GLOW, true)))
	# the web composer blooms whatever is HDR-bright even in silence: the appearance previews' beams need the chain
	# the web composer blooms whatever is HDR-bright even in silence: the appearance previews' beams need the chain
	var lit := _glow_level.is_lit() or _preview != null
	if lit != _glow.is_lit():
		_glow.set_lit(lit)
		_composite.set_shader_parameter("lit", lit)
	if lit:
		_glow.sync_models()
	_glow.set_intensity(_glow_level.intensity())

func _add_view() -> void:
	_view = TextureRect.new()
	_view.name = "View"
	_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_view.stretch_mode = TextureRect.STRETCH_SCALE
	_view.texture = _viewport.get_texture()
	_composite = ShaderMaterial.new()
	_composite.shader = COMPOSITE_SHADER
	_composite.set_shader_parameter("edge", _glow.edge_texture())
	_composite.set_shader_parameter("bloom", _glow.bloom_texture())
	_composite.set_shader_parameter("bloom_intensity", MenuEdgeGlow.BLOOM_INTENSITY)
	_view.material = _composite
	add_child(_view)
	_view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

## web Canvas: the scene renders at the backdrop's size in device pixels (dpr [1, 2] — the Windows scale).
func _fit() -> void:
	var pixels := UiScale.device_size(size, UiScale.of(self))
	_viewport.size = pixels
	_glow.set_size(pixels)

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
	_glow.add_model(entry.visual)
	return entry

func _place_camera() -> void:
	_camera.position = rig.position
	_camera.look_at(rig.look)
