class_name Body extends RefCounted
## Entity body: accumulates movement intent into `desired`. Position/collisions are owned by
## the CharacterBody3D host; Body is pure math. Ported from web-reference/src/game/Body.ts.

var position := Vector3(0, MoveConst.EYE_HEIGHT, 0)
var velocity_y := 0.0
var grounded := true
var just_jumped := false

var _vel_h := Vector3.ZERO       # persistent horizontal velocity (Quake inertia)
var _wish_vel := Vector3.ZERO    # desired velocity from input this frame (magnitude = wishspeed)
var _air_jumps := MoveConst.MAX_AIR_JUMPS
var _jump_held := false
var _prev_jump_held := false
var _jumped_this_frame := false
var _desired := Vector3.ZERO
var _dash_dir := Vector3.ZERO
var _dash_timer := 0.0
var _dash_cooldown := 0.0

# --- horizontal (Quake inertia) ---

func move(world_dir: Vector3) -> void:
	_wish_vel = world_dir

func step_horizontal(dt: float) -> void:
	var wishspeed := _wish_vel.length()
	var wishdir := Vector3.ZERO
	if wishspeed > 1e-6:
		wishdir = _wish_vel / wishspeed
	if grounded:
		if not _jumped_this_frame:
			_vel_h *= maxf(0.0, 1.0 - MoveConst.GROUND_FRICTION * dt)
		if wishspeed > 1e-6:
			_accelerate(wishdir, wishspeed, MoveConst.GROUND_ACCEL, dt)
	elif wishspeed > 1e-6:
		_accelerate(wishdir, minf(wishspeed, MoveConst.AIR_WISH_SPEED), MoveConst.AIR_ACCEL, dt)
	if _vel_h.length_squared() > MoveConst.MAX_SPEED * MoveConst.MAX_SPEED:
		_vel_h = _vel_h.normalized() * MoveConst.MAX_SPEED
	_desired.x += _vel_h.x * dt
	_desired.z += _vel_h.z * dt

func _accelerate(wishdir: Vector3, wishspeed: float, accel: float, dt: float) -> void:
	var current := _vel_h.dot(wishdir)
	var add := wishspeed - current
	if add <= 0.0:
		return
	var accel_speed := minf(accel * wishspeed * dt, add)
	_vel_h += wishdir * accel_speed

# --- vertical / jump ---

func set_jump_input(held: bool) -> void:
	_jump_held = held

func step_jump() -> void:
	_jumped_this_frame = false
	just_jumped = false
	var edge := _jump_held and not _prev_jump_held
	if grounded and _jump_held:
		velocity_y = MoveConst.JUMP_FORCE          # auto-bhop
		_air_jumps = MoveConst.MAX_AIR_JUMPS
		_jumped_this_frame = true
		just_jumped = true
	elif edge and not grounded and _air_jumps > 0:
		velocity_y = MoveConst.JUMP_FORCE          # double jump on a NEW press
		_air_jumps -= 1
		just_jumped = true
	_prev_jump_held = _jump_held

func step_vertical(dt: float) -> void:
	velocity_y += MoveConst.GRAVITY * dt
	_desired.y += velocity_y * dt

func set_grounded(g: bool) -> void:
	grounded = g
	if g:
		velocity_y = 0.0
		_air_jumps = MoveConst.MAX_AIR_JUMPS

# --- dash ---

func dash(dir: Vector3) -> bool:
	if _dash_cooldown > 0.0:
		return false
	if dir.length_squared() == 0.0:
		return false
	_dash_dir = dir.normalized()
	_dash_timer = MoveConst.DASH_DURATION_MS
	_dash_cooldown = MoveConst.DASH_COOLDOWN_MS
	return true

func step_dash(dt: float) -> void:
	if _dash_cooldown > 0.0:
		_dash_cooldown -= dt * 1000.0
	if _dash_timer > 0.0:
		_desired += _dash_dir * (MoveConst.DASH_SPEED * dt)
		_dash_timer -= dt * 1000.0

func is_dashing() -> bool:
	return _dash_timer > 0.0

func dash_progress() -> float:
	if _dash_cooldown > 0.0:
		return maxf(0.0, 1.0 - _dash_cooldown / MoveConst.DASH_COOLDOWN_MS)
	return 1.0

func reset_dash_cooldown() -> void:
	_dash_cooldown = 0.0

# --- shared ---

func consume_desired() -> Vector3:
	var d := _desired
	_desired = Vector3.ZERO
	return d

func halt() -> void:
	_vel_h = Vector3.ZERO
	_wish_vel = Vector3.ZERO
	velocity_y = 0.0

## Respawn/teleport: don't carry inertia or dash cooldown over.
func set_position(p: Vector3) -> void:
	position = p
	velocity_y = 0.0
	_vel_h = Vector3.ZERO
	_wish_vel = Vector3.ZERO
	_dash_timer = 0.0
	_dash_cooldown = 0.0
	grounded = p.y <= MoveConst.EYE_HEIGHT + 0.01

func horizontal_speed() -> float:
	return Vector2(_vel_h.x, _vel_h.z).length()
