class_name Player extends RefCounted
## Composes a Body and exposes intent methods (the same surface a bot will drive later).
## 2a slice: movement only — no weapon/shield/respawn yet. Ported from web Player.ts (trimmed).

var body := Body.new()
var frozen := false
var id := 0                 # entity id (seat) — set by the host/match
var team := 0               # team (same team -> no harm); set by the match
var alive := true
var kills := 0              # session score
var deaths := 0
var streak := 0             # consecutive kills without dying
var respawn_timer := 0.0    # ms remaining in the ghost phase
var respawning := false     # ghost phase
var pierce_walls := false   # SINGULARITY pierce (false until overheat)
var weapon = null   # a BeamWeapon (injected by the host); null in movement-only contexts
var shield = null   # a Shield (injected by the host); null in movement-only contexts
var _look_dir := Vector3(0, 0, -1)
var _aim_point := Vector3(0, MoveConst.EYE_HEIGHT, -100)
var _aim_origin := Vector3.ZERO
var _has_aim_origin := false

func can_move() -> bool:
	return not frozen and (alive or respawning)

func can_act() -> bool:
	return not frozen and alive

func move_intent(dir: Vector3) -> void:
	if not can_move():
		return
	body.move(dir)

func set_jump_input(held: bool) -> void:
	body.set_jump_input(can_move() and held)

func set_look(dir: Vector3) -> void:
	if dir.length_squared() > 1e-8:
		_look_dir = dir

func dash(dir: Vector3) -> bool:
	if not can_act():
		return false
	if dir.length_squared() == 0.0:
		return false
	if not body.dash(dir):
		return false
	if weapon != null:
		weapon.interrupt()   # a successful dash cancels the windup (web parity)
	return true

func set_frozen(v: bool) -> void:
	frozen = v
	if v:
		body.halt()

func look_dir() -> Vector3:
	return _look_dir

# --- opponent-read accessors (used by the bot AI) ---

func position() -> Vector3:
	return body.position

func is_dashing() -> bool:
	return body.is_dashing()

func shield_active() -> bool:
	return is_shielded()

func windup_progress() -> float:
	return weapon.windup_progress() if weapon != null else 0.0

# --- HUD readouts (1 = ready) ---

func beam_progress() -> float:
	return weapon.cooldown_progress() if weapon != null else 1.0

func shield_progress() -> float:
	return shield.progress() if shield != null else 1.0

func dash_progress() -> float:
	return body.dash_progress()

func speed() -> float:
	return body.horizontal_speed()

# --- combat rules (driven by the match, never self-respawn) ---

## Verdict of an incoming beam on this player: "blocked" (dead/ghost or shield up) or "killed".
func receive_hit() -> String:
	if not alive:
		return "blocked"          # already dead/ghost — no double kill
	if is_shielded():
		return "blocked"
	alive = false
	_start_ghost()
	return "killed"

## Non-owner death application (idempotent) — used by apply_kill for peers that didn't judge.
func apply_death() -> void:
	if not alive:
		return
	alive = false
	_start_ghost()

func _start_ghost() -> void:
	respawning = true
	respawn_timer = MatchConst.RESPAWN_GHOST_MS
	if weapon != null:
		weapon.interrupt()        # the ghost doesn't fire off an unfinished windup

## Materialize at pos (end of the ghost phase). ALL cooldowns reset (beam/shield/dash).
func respawn_at(pos: Vector3) -> void:
	body.set_position(pos)        # teleport + dash cooldown reset
	if weapon != null:
		weapon.reset()
	if shield != null:
		shield.reset()
	alive = true
	respawning = false
	respawn_timer = 0.0

## Reward reset: instantly clear beam/shield/dash cooldowns (perfect block / streak break).
func reset_cooldowns() -> void:
	if weapon != null:
		weapon.reset_cooldown()
	if shield != null:
		shield.reset_cooldown()
	body.reset_dash_cooldown()

# --- weapon ---

func set_weapon(w) -> void:
	weapon = w

func start_firing() -> void:
	if not can_act():
		return
	if weapon != null:
		weapon.begin_windup()

func cancel_firing() -> void:
	if not can_act():
		return
	if weapon != null:
		weapon.interrupt()

func is_winding_up() -> bool:
	return weapon != null and weapon.is_winding_up()

## Aim AT a world point; origin (the human camera) makes the hit ray camera->point.
func aim(point: Vector3, origin = null) -> void:
	_aim_point = point
	_has_aim_origin = origin != null
	if origin != null:
		_aim_origin = origin

func aim_point_for_fx() -> Vector3:
	return _aim_point

## --- shield ---

func set_shield(s) -> void:
	shield = s

func activate_shield() -> void:
	if not can_act():
		return
	if shield != null:
		shield.activate()

func is_shielded() -> bool:
	return shield != null and shield.is_active()

func is_perfect_block() -> bool:
	return shield != null and shield.is_perfect_block()

func update_shield(dt: float) -> void:
	if shield != null:
		shield.update(dt)

func update_weapon(dt: float, exclude_ids: Array) -> void:
	if weapon == null:
		return
	var muzzle := body.position + Vector3(0, MoveConst.MUZZLE_Y, 0)
	var aim_dir := (_aim_point - muzzle).normalized()
	muzzle += aim_dir * MoveConst.BALL_RADIUS   # muzzle on the sphere surface
	var hit_origin: Vector3 = _aim_origin if _has_aim_origin else muzzle
	var hit_dir := (_aim_point - hit_origin).normalized() if _has_aim_origin else aim_dir
	weapon.update(dt, {"muzzle": muzzle, "aim": aim_dir, "hit_origin": hit_origin,
		"hit_dir": hit_dir, "exclude_ids": exclude_ids})
