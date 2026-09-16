class_name PlayerNode extends CharacterBody3D
## Godot host for the sim Body. Runs the fixed tick and applies movement via move_and_slide.
## Adds manual stair/ledge stepping (CharacterBody3D has no native step height) to match the
## web KCC autostep, plus camera smoothing so the step rise isn't an abrupt snap.

const STEP_SMOOTH_SPEED := 6.0     # units/s the camera catches up after a step (visual only)

var player := Player.new()
var controller = null  # optional; must expose apply_intent() -> void

var _step_smooth := 0.0            # visual: how far the camera still lags below the true eye
var _beam_fx: BeamFx
var _shield_fx: ShieldFx
var entity_id := 0
var _flash := 0.0
var _ball: BallVisual
var _hitbox: Hitbox
var _body_visible := true
var _appearance := {}                  # roster entry: colour and cosmetic styles
var _base_color := Color(AppearanceConst.FALLBACK_EFFECT_COLOR)
var _respawn_fx: RespawnFxView
var _respawn_frame := RespawnFxView.Frame.new()
var _windup_world: WindupWorldView
var _dash_trail: DashTrailView
var _visual_ms := 0.0                  # visual clock (web Date.now for fireTime / spawnTime)
var _fire_ms := -INF                   # the last own shot (windup deflate)
var _spawn_ms := 0.0                   # the last materialisation (rebirth poof); web Match places everyone via respawnAt
var _was_respawning := false

const HIT_FLASH_TIME := 0.25
const REMOTE_FIRE_WINDUP := 0.5            # web applyNetState: a told windup above this collapsing to 0 was a shot

var replay := false                        # driven from outside (a demo frame, a peer): no movement or weapon simulation
var _remote_windup := 0.0

func set_body_visible(v: bool) -> void:
	_body_visible = v

## Take the roster entry's look: ball colour / model / ring / art, windup and respawn styles, the player colour of the
## particle effects (web Match builds Player + Body from the RosterEntry).
func apply_appearance(entry: Dictionary) -> void:
	_appearance = entry
	_base_color = Color(entry.get("color", AppearanceConst.FALLBACK_EFFECT_COLOR))
	if _ball == null:
		return   # not ready yet: _ready applies the stored entry
	if entry.get("kind", "") == Roster.KIND_BOT:
		_beam_fx.setup(BeamFx.STYLE_CLASSIC, BeamCurves.BOT_SHELL_COLOR)   # web Match: red "enemy" beam for bots
	else:
		_beam_fx.setup(entry.get("windupStyle", BeamFx.STYLE_CLASSIC), _base_color)
	_ball.setup(_base_color, entry.get("ballModel", AppearanceConst.BALL_MODELS[0]),
		Color(entry.get("reserveColor", entry.get("color", AppearanceConst.FALLBACK_EFFECT_COLOR))),
		entry.get("ballArt", ""))
	_shield_fx.setup(entry.get("shieldStyle", ShieldSkinState.DOME))
	_dash_trail.setup(entry.get("dashStyle", DashTrailView.STYLE_STREAK), _base_color)
	_respawn_fx.setup(entry.get("respawnStyle", AppearanceConst.RESPAWN_STYLES[0]), _base_color, _roll)
	_windup_world.setup(entry.get("windupStyle", AppearanceConst.WINDUP_STYLES[0]), _roll)

func ball_visual() -> BallVisual:
	return _ball

func burst_view() -> ParticleView:
	return _respawn_fx.burst_view()

func ghost_trail_view() -> ParticleView:
	return _respawn_fx.ghost_trail_view()

func respawn_fx() -> RespawnFxView:
	return _respawn_fx

func windup_world() -> WindupWorldView:
	return _windup_world

func is_body_visible() -> bool:
	return _body_visible

## How far the eye still lags below its true height after a step-up (the camera owner eases it out).
func step_lag() -> float:
	return _step_smooth

func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	up_direction = Vector3.UP
	floor_constant_speed = true                                   # keep horizontal speed on ramps
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(MoveConst.KCC_SLOPE_DEG)         # 50° climb/slide (web KCC_SLOPE_DEG)
	global_position = player.body.position
	collision_layer = CombatConst.LAYER_PLAYER_BIT               # movement capsule: not a combat target
	collision_mask = CombatConst.MOVE_MASK                       # collide with both wall kinds
	_beam_fx = BeamFx.new()
	_beam_fx.name = "BeamFx"
	add_child(_beam_fx)
	var raycaster := WorldRaycaster.new(get_world_3d().direct_space_state)
	player.set_weapon(BeamWeapon.new(raycaster))
	_shield_fx = ShieldFx.new()
	add_child(_shield_fx)
	player.set_shield(Shield.new())
	# Combat hitbox (layer 3), separate from the movement capsule — makes this entity shootable.
	entity_id = player.id
	add_to_group("targets")
	_hitbox = Hitbox.new()
	_hitbox.entity_id = player.id
	var hcs := CollisionShape3D.new()
	var hbox := BoxShape3D.new()
	hbox.size = Vector3(1, 2, 1)
	hcs.shape = hbox
	_hitbox.add_child(hcs)
	_hitbox.position = Vector3(0, MoveConst.HITBOX_Y, 0)
	add_child(_hitbox)
	_dash_trail = DashTrailView.new()
	_dash_trail.name = "DashTrail"
	add_child(_dash_trail)
	_ball = BallVisual.new()
	_ball.name = "BallVisual"
	_ball.position.y = SkinCurves.BODY_MESH_Y
	add_child(_ball)
	_shield_fx.position.y = SkinCurves.BODY_MESH_Y   # web: the shield rides at the ball centre
	_respawn_fx = RespawnFxView.new()
	_respawn_fx.name = "RespawnFx"
	add_child(_respawn_fx)
	_windup_world = WindupWorldView.new()
	_windup_world.name = "WindupWorld"
	add_child(_windup_world)
	apply_appearance(_appearance)

## Teleport onto a spawn point: moves the sim body and the physics body together, without an interpolated slide.
func place_at(pos: Vector3) -> void:
	player.body.position = pos
	global_position = pos
	reset_physics_interpolation()

func hitbox_rid() -> RID:
	return _hitbox.get_rid()

func _physics_process(delta: float) -> void:
	if replay:
		_replay_tick()
		return
	if controller != null:
		controller.apply_intent(delta)
	var b := player.body
	b.step_jump()
	b.step_horizontal(delta)
	b.step_vertical(delta)
	b.step_dash(delta)
	var desired := b.consume_desired()
	velocity = desired / delta
	_step_up_if_blocked(Vector3(desired.x, 0.0, desired.z))   # before the move, as the web KCC steps inside its sweep
	move_and_slide()
	b.set_grounded(is_on_floor())
	b.position = global_position
	player.update_weapon(delta, [_hitbox.get_rid()])   # exclude own hitbox from the beam
	player.update_shield(delta)
	_shield_fx.show_dome(player.is_shielded() and _shield_can_show())
	var w = player.weapon
	if w != null and w.just_fired:
		_fire_ms = _visual_ms
		var o: Dictionary = w.outcome
		_beam_fx.play(_muzzle_point(), o["end"])
		var eid: int = int(o["hit_entity_id"])
		if eid >= 0:
			if o["hit_point"] != null and controller is HumanController:
				_beam_fx.spawn_impact(o["hit_point"])   # web: only the human's own hits spark, blocked or not
			var target = _find_target(eid)
			if target != null and target.has_method("is_shielded") and target.is_shielded():
				if target.has_method("on_block"):
					target.on_block()          # the shield wins: no hit flash
			elif target != null and target.has_method("on_hit"):
				target.on_hit()
		w.clear_just_fired()

## A replayed player: the shield bubble follows what it was told, and a told windup collapsing marks the shot for the
## ball's deflate (web applyNetState netFireTime). Its place comes from `place_at` per frame (web setReplayPose).
func _replay_tick() -> void:
	_shield_fx.show_dome(player.is_shielded() and _shield_can_show())
	var windup := player.windup_progress()
	if _remote_windup > REMOTE_FIRE_WINDUP and windup == 0.0:
		_fire_ms = _visual_ms
	_remote_windup = windup

## web cosmeticFire: a replayed shot — the beam from the sphere's surface toward its recorded end, sparks at the hit.
func play_remote_beam(end: Vector3, hit_point = null) -> void:
	var centre := global_position + Vector3(0.0, MoveConst.MUZZLE_Y, 0.0)
	_beam_fx.play(centre + (end - centre).normalized() * MoveConst.BALL_RADIUS, end)
	if hit_point != null:
		_beam_fx.spawn_impact(hit_point)

## When the last shot's deflate started on the visual clock (-INF before any).
func fire_ms() -> float:
	return _fire_ms

func _muzzle_point() -> Vector3:
	var base := global_position + Vector3(0, MoveConst.MUZZLE_Y, 0)
	var aim := (player.aim_point_for_fx() - base).normalized()
	return base + aim * MoveConst.BALL_RADIUS

func _find_target(eid: int):
	for d in get_tree().get_nodes_in_group("targets"):
		if is_instance_valid(d) and d != self and "entity_id" in d and d.entity_id == eid:
			return d
	return null

# --- shootable-target surface (so bot and human can hit each other) ---

func is_shielded() -> bool:
	return player.is_shielded()

func on_hit() -> void:
	_flash = HIT_FLASH_TIME

func on_block() -> void:
	_flash = 0.0   # a block shows no hit flash (dome already visible)

func is_flashing() -> bool:
	return _flash > 0.0

var _nameplate: Nameplate = null         # web setNameplate: over other players in 2v2 / FFA

## Attach (or with null remove) the name plate; it shows while the player is alive (web: dies with the body).
func set_nameplate(plate: Nameplate) -> void:
	if _nameplate != null:
		_nameplate.queue_free()
	_nameplate = plate
	if plate != null:
		add_child(plate)

func nameplate() -> Nameplate:
	return _nameplate

func _process(delta: float) -> void:
	# Smoothly close the eye's step lag so a climb reads as a rise, not a snap (HumanController places the camera).
	if _step_smooth > 0.0:
		_step_smooth = maxf(0.0, _step_smooth - STEP_SMOOTH_SPEED * delta)
	if _beam_fx != null:
		_beam_fx.update_fx(delta)
	_flash = maxf(0.0, _flash - delta)
	var ghost := player.respawning
	if _hitbox != null:
		_hitbox.collision_layer = 0 if ghost else CombatConst.LAYER_HITBOX_BIT   # the ghost can't be shot
	update_visuals(delta)

## The ball's per-frame look (web Player.syncVisuals): the windup strategy (ball + world part) outside the ghost, then
## the respawn strategy (death edge, ghost, rebirth window beating the windup scale), the dash trail and the shield.
func update_visuals(delta: float) -> void:
	if _ball == null:
		return
	_visual_ms += delta * SkinCurves.MS_PER_S
	var ghost := player.respawning
	var origin := global_position + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
	if ghost and not _was_respawning and _body_visible:
		_respawn_fx.on_death(origin, _roll)
	if _was_respawning and not ghost:
		_spawn_ms = _visual_ms
	_was_respawning = ghost
	_ball.visible = _body_visible
	_ball.face_dir(player.look_dir())
	_ball.tick(delta)
	if ghost:
		_ball.set_emission(Color.BLACK)
		_windup_world.visible = false
	else:
		_ball.set_opacity(1.0)
		var progress := player.windup_progress()
		var shrink := SkinCurves.shrink(_visual_ms - _fire_ms)
		var look := SkinCurves.windup_ball(_appearance.get("windupStyle", AppearanceConst.WINDUP_STYLES[0]),
			progress, shrink, _base_color, _visual_ms / SkinCurves.MS_PER_S)
		_ball.set_scale_factor(look["scale"])
		_ball.set_color(look["color"])
		_ball.set_emission(look["emission"])
		_windup_world.apply(delta, progress, shrink, origin, player.look_dir(), _body_visible, _roll)
	_respawn_fx.apply(delta, _ball, _fill_respawn_frame(ghost, origin), _roll)
	_respawn_fx.update(delta)
	_dash_trail.visible = _body_visible   # web setBodyVisible: no own trail in first person
	_dash_trail.update(delta, player.is_dashing(), global_position)
	if _nameplate != null:
		_nameplate.visible = player.alive   # hidden from the kill until the respawn
	_shield_fx.update(delta)

func _fill_respawn_frame(ghost: bool, origin: Vector3) -> RespawnFxView.Frame:
	var f := _respawn_frame
	f.ghost = ghost
	f.ghost_left = maxf(0.0, player.respawn_timer / MatchConst.RESPAWN_GHOST_MS)   # web respawnProgress
	f.since_rebirth_ms = _visual_ms - _spawn_ms
	f.origin = origin
	f.eye = global_position
	f.base_color = _base_color
	f.shown = _body_visible
	return f

## web Math.random for the cosmetic strategies.
func _roll() -> float:
	return randf()

func dash_trail() -> DashTrailView:
	return _dash_trail

func shield_fx() -> ShieldFx:
	return _shield_fx

## web: no shield bubble in first person, during the ghost phase or the rebirth window.
func _shield_can_show() -> bool:
	return _body_visible and not player.respawning and not _respawn_fx.is_rebirth_active(_visual_ms - _spawn_ms)

## The web KCC's autostep: the sweep that carries the player forward also lifts it over a step, so no speed is lost on
## the way up. Here the lift happens BEFORE move_and_slide, and only when the horizontal path is actually blocked —
## probe up -> forward (AUTOSTEP_MIN_WIDTH of landing, as web) -> down onto walkable ground higher than we started.
## Works grounded or airborne (matches web autostep), so you can also jump onto ledges.
func _step_up_if_blocked(horiz: Vector3) -> void:
	if horiz.length() < 1e-4 or not test_move(global_transform, horiz):
		return
	var max_h := MoveConst.AUTOSTEP_MAX_HEIGHT
	var probe := horiz.normalized() * MoveConst.AUTOSTEP_MIN_WIDTH

	# 1. Headroom: how high can we rise before a ceiling stops us?
	var up_res := KinematicCollision3D.new()
	var up_dist := max_h
	if test_move(global_transform, Vector3.UP * max_h, up_res):
		up_dist = up_res.get_travel().length()
	if up_dist < 0.05:
		return
	var lifted := global_transform.translated(Vector3.UP * up_dist)

	# 2. From the lifted pose, can we move forward over the ledge?
	var fwd_res := KinematicCollision3D.new()
	var advanced := probe
	if test_move(lifted, probe, fwd_res):
		advanced = fwd_res.get_travel()
	if advanced.length() < probe.length():
		return  # no room for the whole foot -> a real wall, not a step (web AUTOSTEP_MIN_WIDTH)
	var over := lifted.translated(advanced)

	# 3. Drop back down onto the step surface — it has to be ground the player could stand on.
	var down_res := KinematicCollision3D.new()
	if not test_move(over, Vector3.DOWN * (up_dist + 0.05), down_res):
		return  # nothing beneath -> would be stepping into the air
	if down_res.get_normal().y < cos(deg_to_rad(MoveConst.KCC_SLOPE_DEG)):
		return  # too steep to stand on -> the KCC would slide off it
	var landed := over.translated(down_res.get_travel())
	var dy := landed.origin.y - global_position.y
	if dy > 0.02:
		global_position = landed.origin
		velocity.y = 0.0
		player.body.velocity_y = 0.0
		_step_smooth = minf(_step_smooth + dy, max_h)   # camera absorbs the rise, then eases up
