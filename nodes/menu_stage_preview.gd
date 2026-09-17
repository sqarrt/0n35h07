class_name MenuStagePreview extends Node3D
## The appearance screen's one-shot style previews on your backdrop ball — port of web MenuBackdrop StageBall with its
## windup, beam, respawn, dash-trail and shield skins: a style click runs that style's timeline (MenuPreviewCycles) with
## the in-game effects. The ghost run circles the stage spot and holds a dash back; the ball returns to its spot when
## a run ends. `hold_ms` (parity captures, web __debugPreviewHoldMs) stops the preview clock that long after the click.

const NO_HOLD := -1.0
const MESH_OFFSET := Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)   # the ball centre under the eye spot
## Part (the preview kind) -> the preview spec's style key.
const STYLE_KEYS := {MenuCameraRig.PART_SHOT: "windup", MenuCameraRig.PART_RESPAWN: "respawn",
	MenuCameraRig.PART_DASH: "dash", MenuCameraRig.PART_SHIELD: "shield"}
const COLOR_KEY := "color"

var hold_ms := NO_HOLD

var _windup_world: WindupWorldView
var _beam: BeamFx
var _respawn: RespawnFxView
var _trail: DashTrailView
var _shield: ShieldFx
var _frame := RespawnFxView.Frame.new()
var _styles := {}
var _color := Color.WHITE
var _clock_ms := 0.0
var _shot_ms := INF
var _respawn_ms := INF
var _dash_ms := INF
var _shield_ms := INF
var _time_s := 0.0
var _death_pending := false
var _last_shot := MenuPreviewCycles.IDLE
var _last_respawn := MenuPreviewCycles.IDLE
var _last_dash := MenuPreviewCycles.IDLE
var _last_shield := false

func _ready() -> void:
	name = "StagePreview"
	_windup_world = WindupWorldView.new()
	_beam = BeamFx.new()
	_respawn = RespawnFxView.new()
	_trail = DashTrailView.new()
	_shield = ShieldFx.new()
	for fx in [_windup_world, _beam, _respawn, _trail, _shield]:
		add_child(fx)
	_shield.show_dome(false)

## The styles and colour of the preview spec; an effect is rebuilt only when its look changes (web useMemo deps).
func setup_styles(spec: Dictionary) -> void:
	var color := Color(spec.get(COLOR_KEY, _color.to_html()))
	var recolored := color != _color
	_color = color
	for kind in STYLE_KEYS:
		var style: String = spec.get(STYLE_KEYS[kind], "")
		if style.is_empty():
			continue
		var colored: bool = kind != MenuCameraRig.PART_SHIELD and recolored
		if _styles.get(kind) == style and not colored:
			continue
		_styles[kind] = style
		match kind:
			MenuCameraRig.PART_SHOT:
				_windup_world.setup(style, _roll)
				_beam.setup(style, _color)
			MenuCameraRig.PART_RESPAWN:
				_respawn.setup(style, _color, _roll)
			MenuCameraRig.PART_DASH:
				_trail.setup(style, _color)
			_:
				_shield.setup(style)

## A style click: that preview starts now, with its sound (web seq effects).
func trigger(kind: String, style: String) -> void:
	_clock_ms = 0.0
	match kind:
		MenuCameraRig.PART_SHOT:
			_shot_ms = 0.0
			UiSounds.play(MatchSfx.windup_event(style, Audio.sfx()))
		MenuCameraRig.PART_RESPAWN:
			_respawn_ms = 0.0
			_death_pending = true
			UiSounds.play(MatchSfx.EVENT_DEATH)
		MenuCameraRig.PART_DASH:
			_dash_ms = 0.0
			UiSounds.play(MatchSfx.EVENT_DASH)
		MenuCameraRig.PART_SHIELD:
			_shield_ms = 0.0
			UiSounds.play(MatchSfx.EVENT_SHIELD_UP)

func shield() -> ShieldFx:
	return _shield

func beam() -> BeamFx:
	return _beam

## One frame on your ball standing at `spot`: `color` the eased colour, `stage_scale` its appear / leave scale, `aim`
## where it looks outside a run (web aimDir).
func step(dt: float, visual: BallVisual, spot: Vector3, color: Color, stage_scale: float, spec: Dictionary,
		aim: Vector3) -> void:
	setup_styles(spec)
	var pdt := dt if hold_ms < 0.0 else clampf((hold_ms - _clock_ms) / MenuPreviewCycles.MS_PER_S, 0.0, dt)
	_clock_ms += pdt * MenuPreviewCycles.MS_PER_S
	_time_s += pdt
	var home := spot + MESH_OFFSET
	var advance := pdt * MenuPreviewCycles.MS_PER_S
	if _death_pending:
		_respawn.on_death(home, _roll)
		_death_pending = false
	# web StageBall order: the ghost run reads the respawn clock before this frame's step; the dash, shield and shot
	# clocks step first, the respawn clock steps last
	var ghost_theta: Dictionary = MenuPreviewCycles.respawn(_respawn_ms)
	var ghost_run: bool = ghost_theta["phase"] == MenuPreviewCycles.GHOST
	if not ghost_run:
		_dash_ms += advance
	_shield_ms += advance
	_shot_ms += advance
	_respawn_ms += advance
	var respawn := MenuPreviewCycles.respawn(_respawn_ms)
	visual.position = home
	var facing := aim
	if ghost_run:
		visual.position += MenuPreviewCycles.ghost_offset(ghost_theta["theta"])
		facing = MenuPreviewCycles.ghost_facing(ghost_theta["theta"])
	var dash := MenuPreviewCycles.dash(_dash_ms)
	var dashing := false
	if not ghost_run and dash["phase"] != MenuPreviewCycles.IDLE:
		visual.position.x += dash["offset"]
		if dash["phase"] in [MenuPreviewCycles.OUT, MenuPreviewCycles.BACK]:
			facing = Vector3.RIGHT if dash["phase"] == MenuPreviewCycles.OUT else Vector3.LEFT
			dashing = true
	if dash["phase"] == MenuPreviewCycles.BACK and _last_dash == MenuPreviewCycles.PAUSE:
		UiSounds.play(MatchSfx.EVENT_DASH)   # the second dash sounds too
	_last_dash = dash["phase"]
	visual.face_dir(facing)
	var origin := visual.position
	_step_shield(pdt, origin)
	_step_shot(pdt, visual, origin, color, stage_scale, aim)
	_step_respawn(pdt, visual, origin, color, respawn)
	_trail.update(pdt, dashing, origin - MESH_OFFSET)

func _step_shield(pdt: float, origin: Vector3) -> void:
	var on := MenuPreviewCycles.shield_active(_shield_ms)
	if _last_shield and not on:
		UiSounds.play(MatchSfx.EVENT_SHIELD_DOWN)
	_last_shield = on
	_shield.position = origin
	_shield.show_dome(on)
	_shield.update(pdt)

func _step_shot(pdt: float, visual: BallVisual, origin: Vector3, color: Color, stage_scale: float, aim: Vector3) -> void:
	var shot := MenuPreviewCycles.shot(_shot_ms)
	if shot["phase"] == MenuPreviewCycles.FIRE and _last_shot == MenuPreviewCycles.CHARGE:
		_beam.play(origin, origin + aim * MenuPreviewCycles.BEAM_LENGTH_RADII * MoveConst.BALL_RADIUS)
	_last_shot = shot["phase"]
	var look := SkinCurves.windup_ball(_styles.get(MenuCameraRig.PART_SHOT, AppearanceConst.WINDUP_STYLES[0]),
		shot["progress"], shot["shrink"], color, _time_s)
	visual.set_scale_factor(stage_scale * float(look["scale"]))
	visual.set_color(look["color"])
	visual.set_emission(look["emission"])
	_windup_world.apply(pdt, shot["progress"], shot["shrink"], origin, aim, true, _roll)
	_beam.update_fx(pdt)

func _step_respawn(pdt: float, visual: BallVisual, origin: Vector3, color: Color, respawn: Dictionary) -> void:
	if respawn["phase"] == MenuPreviewCycles.REBIRTH and _last_respawn == MenuPreviewCycles.GHOST:
		UiSounds.play(MatchSfx.EVENT_RESPAWN)   # the respawn sound at the start of the reassembly
	_last_respawn = respawn["phase"]
	_frame.ghost = respawn["phase"] == MenuPreviewCycles.GHOST
	_frame.ghost_left = respawn["ghost_left"]
	_frame.since_rebirth_ms = respawn["since_rebirth_ms"]
	_frame.origin = origin
	_frame.eye = origin - MESH_OFFSET
	_frame.base_color = color
	_frame.shown = true
	_respawn.apply(pdt, visual, _frame, _roll)
	_respawn.update(pdt)

## web Math.random for the cosmetic strategies.
func _roll() -> float:
	return randf()
