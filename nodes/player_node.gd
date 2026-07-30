class_name PlayerNode extends CharacterBody3D
## Godot host for the sim Body. Runs the fixed tick and applies movement via move_and_slide.
## Adds manual stair/ledge stepping (CharacterBody3D has no native step height) to match the
## web KCC autostep, plus camera smoothing so the step rise isn't an abrupt snap.

const STEP_FORWARD_PROBE := 0.35   # how far ahead to test for a step (~capsule radius)
const STEP_SMOOTH_SPEED := 6.0     # units/s the camera catches up after a step (visual only)

var player := Player.new()
var controller = null  # optional; must expose apply_intent() -> void

@onready var _cam: Camera3D = get_node_or_null("Camera3D")
var _step_smooth := 0.0            # visual: how far the camera still lags below the true eye
var _beam_fx: BeamFx
var _shield_fx: ShieldFx
var entity_id := 0
var _flash := 0.0
var _mesh: MeshInstance3D
var _hitbox: Hitbox

const HIT_FLASH_TIME := 0.25

func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	up_direction = Vector3.UP
	floor_constant_speed = true                                   # keep horizontal speed on ramps
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(MoveConst.KCC_SLOPE_DEG)         # 50° climb/slide (web KCC_SLOPE_DEG)
	global_position = player.body.position
	collision_layer = CombatConst.LAYER_PLAYER_BIT               # movement capsule: not a combat target
	collision_mask = CombatConst.LAYER_WORLD_BIT                 # collide with world walls only
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
	_mesh = get_node_or_null("Mesh")

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
	_shield_fx.show_dome(player.is_shielded())
	var w = player.weapon
	if w != null and w.just_fired:
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
	# Smoothly close the camera's step lag so a climb reads as a rise, not a snap.
	if _cam != null and _step_smooth > 0.0:
		_step_smooth = maxf(0.0, _step_smooth - STEP_SMOOTH_SPEED * delta)
		_cam.position.y = -_step_smooth
	if _beam_fx != null:
		_beam_fx.update_fx(delta)
	if _flash > 0.0:
		_flash = maxf(0.0, _flash - delta)
		if _mesh != null:
			_mesh.transparency = 1.0 - (_flash / HIT_FLASH_TIME) * 0.7   # brief fade pulse

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
