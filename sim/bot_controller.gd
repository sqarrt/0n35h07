class_name BotController extends RefCounted
## Bot AI: state machine (WANDER/CHASE/STRAFE/RETREAT) + windup reaction, shield bait, evade.
## Drives a Player through the same intent methods a human does. Ported from web BotController.ts.
## Per-frame rolls use randf() (web Math.random); personality/aim rolls take an rng Callable.

enum State { WANDER, CHASE, STRAFE, RETREAT }

var _player: Player
var _get_target: Callable    # () -> Player or null
var _raycaster                # raycast(origin, dir, exclude_ids, pierce) -> HitResult | null
var _passive: bool
var _p: BotPersonality        # personality

var state := State.WANDER
var _waypoint := BotConst.random_arena_pos()
var _shoot_timer := 0.0
var _shield_timer := 0.0
var _retreat_timer := 0.0
var _strafe_dir := 1.0
var _strafe_flip_timer := 0.0
var _dodge_reaction_timer := -1.0
var _shot_is_hit := false
var _bait_cooldown_ms := 0.0
var _bait_tried_this_shot := false
var _pending_real_shot := false
var _last_known_pos := Vector3.ZERO
var _self_exclude: Array = []   # RIDs to skip in LOS (the bot's own hitbox)

func set_self_exclude(a: Array) -> void:
	_self_exclude = a

func _init(player: Player, get_target: Callable, raycaster, passive: bool, personality: BotPersonality) -> void:
	_player = player
	_get_target = get_target
	_raycaster = raycaster
	_passive = passive
	_p = personality

func _rnd() -> float:
	return randf()

# Controller contract used by PlayerNode.
func apply_intent(dt: float) -> void:
	update(dt)

func update(dt: float) -> void:
	if _passive:
		return
	var pos := _player.position()
	var opp = _get_target.call()
	if opp == null:
		_player.set_jump_input(false)
		_wander(pos, dt)
		return
	var opp_pos: Vector3 = opp.position()

	if _player.respawning:
		_shoot_timer = 0.0
		_shield_timer = 0.0
		_pending_real_shot = false
		_player.set_jump_input(false)
		_wander(pos, dt)
		return

	var has_los := _has_los(pos, opp_pos, opp.id)
	if has_los:
		_last_known_pos = opp_pos
	var dist := pos.distance_to(opp_pos)

	# DODGE reaction (independent of the main state)
	if has_los and opp.windup_progress() > BotConst.BOT_DODGE_THRESH:
		if _dodge_reaction_timer < 0.0:
			_dodge_reaction_timer = _p.reaction_ms
	else:
		_dodge_reaction_timer = -1.0
	if _dodge_reaction_timer >= 0.0:
		_dodge_reaction_timer -= dt * 1000.0
		if _dodge_reaction_timer <= 0.0:
			_dodge_reaction_timer = -1.0
			_execute_dodge(pos, opp_pos)

	# Cancel windup on LOS loss
	if not has_los and _player.is_winding_up():
		_player.cancel_firing()

	# Main state
	if _retreat_timer > 0.0:
		_retreat_timer -= dt * 1000.0
		state = State.RETREAT
	elif not has_los:
		state = State.WANDER
	elif dist > BotConst.BOT_CHASE_DIST:
		state = State.CHASE
	else:
		state = State.STRAFE

	match state:
		State.WANDER: _wander(pos, dt)
		State.CHASE: _chase(pos, opp_pos, dt)
		State.STRAFE: _strafe(pos, opp_pos, dt)
		State.RETREAT: _retreat(pos, opp_pos, dt)

	# Shield bait: late in our OWN windup + opponent defending -> dash-cancel, remember the real shot.
	var opp_defending: bool = opp.shield_active() or opp.is_dashing()
	if _bait_cooldown_ms > 0.0:
		_bait_cooldown_ms -= dt * 1000.0
	if not _player.is_winding_up():
		_bait_tried_this_shot = false
	if has_los and _player.is_winding_up() and opp_defending \
			and _player.windup_progress() > BotConst.BOT_BAIT_LATE_PROGRESS \
			and not _bait_tried_this_shot and _bait_cooldown_ms <= 0.0:
		_bait_tried_this_shot = true
		if randf() < _p.bait_skill:
			var to := (opp_pos - pos); to.y = 0.0; to = to.normalized()
			var perp := Vector3(-to.z, 0, to.x) * _strafe_dir
			_player.dash(perp)              # aborts the windup
			_bait_cooldown_ms = BotConst.BOT_BAIT_COOLDOWN_MS
			_pending_real_shot = true
			_shoot_timer = 0.0

	# Firing (CHASE + STRAFE with LOS)
	if has_los and (state == State.CHASE or state == State.STRAFE):
		if _pending_real_shot and not opp_defending and not _player.is_winding_up():
			_pending_real_shot = false
			_shoot_timer = 0.0
			_shot_is_hit = BotAim.roll_hit(_p.hit_chance, _rnd)
			_player.start_firing()
			_retreat_timer = BotConst.BOT_RETREAT_MS
		else:
			_shoot_timer += dt * 1000.0
			if not _player.is_winding_up() and _shoot_timer >= _p.fire_interval_ms:
				_shoot_timer = 0.0
				_shot_is_hit = BotAim.roll_hit(_p.hit_chance, _rnd)
				_player.start_firing()
				_retreat_timer = BotConst.BOT_RETREAT_MS

	# Aim: hold the locked verdict during windup, else track the target's center.
	var aim_base: Vector3 = opp_pos if has_los else _last_known_pos
	var aim_pt: Vector3
	if _player.is_winding_up():
		aim_pt = BotAim.aim_point(aim_base, pos, _shot_is_hit, _p.graze_margin, _rnd)
	else:
		aim_pt = aim_base
	_player.aim(aim_pt)
	_player.set_look(aim_pt - pos)

	# EVADE: leading on score + under threat -> bunny-hop on top of combat behavior.
	var evading := BotTactics.should_evade({
		"kills": _player.kills, "opp_kills": opp.kills,
		"opp_winding_up": opp.is_winding_up(), "has_los": has_los,
		"dist": dist, "evade_near": BotConst.BOT_EVADE_NEAR})
	if evading:
		_player.set_jump_input(true)
		if randf() < _p.evade_skill * BotConst.BOT_EVADE_DASH_RATE * dt:
			var to := (opp_pos - pos); to.y = 0.0; to = to.normalized()
			var perp := Vector3(-to.z, 0, to.x) * _strafe_dir
			_player.dash(perp)

	# Shield (CHASE + STRAFE)
	if state == State.CHASE or state == State.STRAFE:
		_shield_timer += dt * 1000.0
		if _shield_timer >= BotConst.BOT_SHIELD_INTERVAL_MS:
			_shield_timer = 0.0
			_player.activate_shield()

# --- states ---

func _wander(pos: Vector3, dt: float) -> void:
	var dx := _waypoint.x - pos.x
	var dz := _waypoint.z - pos.z
	var d := sqrt(dx * dx + dz * dz)
	if d < 0.5:
		_waypoint = BotConst.random_arena_pos()
		return
	_player.move_intent(Vector3(dx / d * BotConst.BOT_MOVE_SPEED, 0, dz / d * BotConst.BOT_MOVE_SPEED))
	_player.set_jump_input(randf() < _p.jumpiness * dt)

func _chase(pos: Vector3, opp_pos: Vector3, dt: float) -> void:
	var to := (opp_pos - pos); to.y = 0.0
	var d := to.length()
	if d > 0.1:
		_player.move_intent(to.normalized() * BotConst.BOT_MOVE_SPEED)
	if randf() < _p.dash_rate * dt:
		_player.dash(to.normalized())
	_player.set_jump_input(randf() < _p.jumpiness * dt)

func _strafe(pos: Vector3, opp_pos: Vector3, dt: float) -> void:
	var to := (opp_pos - pos); to.y = 0.0; to = to.normalized()
	var perp := Vector3(-to.z, 0, to.x) * _strafe_dir
	_player.move_intent(perp * BotConst.BOT_MOVE_SPEED)
	_strafe_flip_timer += dt * 1000.0
	if _strafe_flip_timer >= _p.strafe_flip_ms:
		_strafe_flip_timer = 0.0
		_strafe_dir = -_strafe_dir
	_player.set_jump_input(randf() < _p.jumpiness * dt)

func _retreat(pos: Vector3, opp_pos: Vector3, dt: float) -> void:
	var to := (pos - opp_pos); to.y = 0.0
	var d := to.length()
	if d > 0.1:
		_player.move_intent(to.normalized() * BotConst.BOT_MOVE_SPEED)
	_player.set_jump_input(randf() < _p.jumpiness * dt)

# --- helpers ---

func _has_los(from: Vector3, to: Vector3, target_id: int) -> bool:
	var delta := to - from
	var dist := delta.length()
	if dist < 0.5:
		return true
	var hit = _raycaster.raycast(from, delta.normalized(), _self_exclude, _player.pierce_walls)
	return hit != null and hit.entity_id == target_id

func _execute_dodge(pos: Vector3, opp_pos: Vector3) -> void:
	var to := (opp_pos - pos); to.y = 0.0; to = to.normalized()
	var side := 1.0 if randf() < 0.5 else -1.0
	var perp := Vector3(-to.z * side, 0, to.x * side)
	if randf() < _p.dodge_skill:
		_player.dash(perp)
		_player.set_jump_input(true)
	else:
		_player.set_jump_input(true)
