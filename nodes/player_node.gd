class_name PlayerNode extends CharacterBody3D
## Godot host for the sim Body. Runs the fixed tick and applies movement via move_and_slide.
## Adds manual stair/ledge stepping (CharacterBody3D has no native step height) to match the
## web KCC autostep, plus camera smoothing so the step rise isn't an abrupt snap.

const STEP_FORWARD_PROBE := 0.35   # how far ahead to test for a step (~capsule radius)
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
var _death_burst: DeathBurst
var _burst_view: ParticleView
var _ghost_trail: AfterimageTrail
var _ghost_trail_view: ParticleView
var _visual_ms := 0.0                  # visual clock (web Date.now for fireTime / spawnTime)
var _fire_ms := -INF                   # the last own shot (windup deflate)
var _spawn_ms := -INF                  # the last materialisation (rebirth poof); -INF before any respawn
var _was_respawning := false

const HIT_FLASH_TIME := 0.25

func set_body_visible(v: bool) -> void:
	_body_visible = v

## Take the roster entry's look: ball colour / model / ring / art, windup and respawn styles, the player colour of the
## particle effects (web Match builds Player + Body from the RosterEntry).
func apply_appearance(entry: Dictionary) -> void:
	_appearance = entry
	_base_color = Color(entry.get("color", AppearanceConst.FALLBACK_EFFECT_COLOR))
	if _ball == null:
		return   # not ready yet: _ready applies the stored entry
	_ball.setup(_base_color, entry.get("ballModel", AppearanceConst.BALL_MODELS[0]),
		Color(entry.get("reserveColor", entry.get("color", AppearanceConst.FALLBACK_EFFECT_COLOR))),
		entry.get("ballArt", ""))
	_rebuild_particles()

func ball_visual() -> BallVisual:
	return _ball

func burst_view() -> ParticleView:
	return _burst_view

func ghost_trail_view() -> ParticleView:
	return _ghost_trail_view

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
	_ball = BallVisual.new()
	_ball.name = "BallVisual"
	_ball.position.y = SkinCurves.BODY_MESH_Y
	add_child(_ball)
	_shield_fx.position.y = SkinCurves.BODY_MESH_Y   # web: the shield rides at the ball centre
	apply_appearance(_appearance)

## Teleport onto a spawn point: moves the sim body and the physics body together, without an interpolated slide.
func place_at(pos: Vector3) -> void:
	player.body.position = pos
	global_position = pos
	reset_physics_interpolation()

func hitbox_rid() -> RID:
	return _hitbox.get_rid()

func _physics_process(delta: float) -> void:
	if controller != null:
		controller.apply_intent(delta)
	var b := player.body
	b.step_jump()
	b.step_horizontal(delta)
	b.step_vertical(delta)
	b.step_dash(delta)
	var desired := b.consume_desired()
	velocity = desired / delta
	move_and_slide()
	if is_on_wall():
		_try_step_up(Vector3(desired.x, 0.0, desired.z))
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
			var target = _find_target(eid)
			if target != null and target.has_method("is_shielded") and target.is_shielded():
				if target.has_method("on_block"):
					target.on_block()          # the shield wins: no impact, no hit flash
			else:
				if o["hit_point"] != null:
					_beam_fx.spawn_impact(o["hit_point"])
				if target != null and target.has_method("on_hit"):
					target.on_hit()
		w.clear_just_fired()

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

## The ball's per-frame look (web Player.syncVisuals + ClassicWindupFx / EchoRespawnFx): death burst on the death edge,
## translucent ghost with its clone trail, windup swell / deflate, the springy rebirth poof.
func update_visuals(delta: float) -> void:
	if _ball == null:
		return
	_visual_ms += delta * SkinCurves.MS_PER_S
	var ghost := player.respawning
	if ghost and not _was_respawning and _body_visible:
		_death_burst.emit(global_position + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0), func() -> float: return randf())
	if _was_respawning and not ghost:
		_spawn_ms = _visual_ms
	_was_respawning = ghost
	_ball.visible = _body_visible
	_ball.face_dir(player.look_dir())
	_ball.tick(delta)
	var rebirth := SkinCurves.echo_respawn(ghost, _visual_ms - _spawn_ms)
	if ghost:
		_ball.set_scale_factor(rebirth["scale"])
		_ball.set_color(_base_color)
		_ball.set_emission(Color.BLACK)
		_ball.set_opacity(rebirth["opacity"])
	else:
		var look := SkinCurves.windup_ball(_appearance.get("windupStyle", AppearanceConst.WINDUP_STYLES[0]),
			player.windup_progress(), SkinCurves.shrink(_visual_ms - _fire_ms), _base_color,
			_visual_ms / SkinCurves.MS_PER_S)
		_ball.set_scale_factor(look["scale"])
		_ball.set_color(look["color"])
		_ball.set_emission(look["emission"])
		_ball.set_opacity(1.0)
		if rebirth["active"]:   # the poof beats the windup scale
			_ball.set_scale_factor(rebirth["scale"])
			_ball.set_color(_base_color)
	_ghost_trail.update(delta, ghost and _body_visible, global_position)
	_ghost_trail_view.refresh()
	_death_burst.update(delta)
	_burst_view.refresh()

## web: no shield bubble in first person, during the ghost phase or the rebirth window.
func _shield_can_show() -> bool:
	return _body_visible and not player.respawning and not SkinCurves.is_echo_rebirth(_visual_ms - _spawn_ms)

func _rebuild_particles() -> void:
	for view in [_burst_view, _ghost_trail_view]:
		if view != null:
			view.queue_free()
	_death_burst = DeathBurst.new(_base_color)
	_burst_view = ParticleView.new()
	_burst_view.name = "DeathBurst"
	add_child(_burst_view)
	_burst_view.setup(_death_burst.pool, SkinCurves.DEATH_BURST_RADIUS, _base_color)
	_ghost_trail = AfterimageTrail.new(_base_color)
	_ghost_trail_view = ParticleView.new()
	_ghost_trail_view.name = "GhostTrail"
	add_child(_ghost_trail_view)
	_ghost_trail_view.setup(_ghost_trail.pool, SkinCurves.DASH_TRAIL_RADIUS, _base_color)

## Probe up -> forward -> down. If we can rise, advance over the ledge, and land on solid
## ground higher than we started, snap up onto the step. Otherwise it's a real wall — do nothing.
## Works grounded or airborne (matches web autostep), so you can also jump onto ledges.
func _try_step_up(horiz: Vector3) -> void:
	if horiz.length() < 1e-4:
		return
	var max_h := MoveConst.AUTOSTEP_MAX_HEIGHT
	var probe := horiz.normalized() * STEP_FORWARD_PROBE

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
	if advanced.length() < probe.length() * 0.5:
		return  # still blocked -> a real wall, not a step
	var over := lifted.translated(advanced)

	# 3. Drop back down onto the step surface.
	var down_res := KinematicCollision3D.new()
	if not test_move(over, Vector3.DOWN * (up_dist + 0.05), down_res):
		return  # nothing beneath -> would be stepping into the air
	var landed := over.translated(down_res.get_travel())
	var dy := landed.origin.y - global_position.y
	if dy > 0.02:
		global_position = landed.origin
		velocity.y = 0.0
		player.body.velocity_y = 0.0
		_step_smooth = minf(_step_smooth + dy, max_h)   # camera absorbs the rise, then eases up
