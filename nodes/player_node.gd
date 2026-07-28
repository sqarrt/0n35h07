class_name PlayerNode extends CharacterBody3D
## Godot host for the sim Body. Runs the fixed tick and applies movement via move_and_slide.

var player := Player.new()
var controller = null  # optional; must expose apply_intent() -> void

func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	up_direction = Vector3.UP
	floor_constant_speed = true          # keep horizontal speed on ramps (web followSlope)
	floor_snap_length = 0.3
	floor_max_angle = acos(MoveConst.SLOPE_MIN_NORMAL_Y)
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
	move_and_slide()
	b.set_grounded(is_on_floor())
	b.position = global_position
