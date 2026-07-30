class_name PlayerNode extends CharacterBody3D
## Godot host for the sim Body. Runs the fixed tick and applies movement via move_and_slide.
## Adds manual stair/ledge stepping (CharacterBody3D has no native step height) to match the
## web KCC autostep (climb ledges up to AUTOSTEP_MAX_HEIGHT — e.g. onto low blocks).

const STEP_FORWARD_PROBE := 0.35   # how far ahead to test for a step (~capsule radius)

var player := Player.new()
var controller = null  # optional; must expose apply_intent() -> void

func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	up_direction = Vector3.UP
	floor_constant_speed = true                                   # keep horizontal speed on ramps
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(MoveConst.KCC_SLOPE_DEG)         # 50° climb/slide (web KCC_SLOPE_DEG)
	global_position = player.body.position

func _physics_process(delta: float) -> void:
	if controller != null:
		controller.apply_intent()
	var b := player.body
	b.step_jump()
	b.step_horizontal(delta)
	b.step_vertical(delta)
	b.step_dash(delta)
	var desired := b.consume_desired()
	velocity = desired / delta
	var was_grounded := is_on_floor()
	move_and_slide()
	if was_grounded and is_on_wall():
		_try_step_up(Vector3(desired.x, 0.0, desired.z))
	b.set_grounded(is_on_floor())
	b.position = global_position

## Probe up -> forward -> down. If we can rise, advance over the ledge, and land on solid
## ground higher than we started, snap up onto the step. Otherwise it's a real wall — do nothing.
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
	if landed.origin.y > global_position.y + 0.02:
		global_position = landed.origin
		velocity.y = 0.0
		player.body.velocity_y = 0.0
