extends GutTest
## Pure horizontal movement math — no physics server.

func _grounded_body() -> Body:
	var b := Body.new()
	b.grounded = true
	return b

func test_accelerate_gains_speed_toward_wishdir() -> void:
	var b := _grounded_body()
	b.move(Vector3(MoveConst.MOVE_SPEED, 0, 0))  # wish +X at move speed
	b.step_horizontal(1.0 / 60.0)
	var d := b.consume_desired()
	assert_gt(d.x, 0.0, "should move toward +X")
	assert_almost_eq(d.z, 0.0, 1e-6, "no Z drift")

func test_accelerate_never_exceeds_wishspeed_in_one_dir() -> void:
	var b := _grounded_body()
	for i in range(600):  # 10s of holding forward on the ground
		b.move(Vector3(MoveConst.MOVE_SPEED, 0, 0))
		b.step_horizontal(1.0 / 60.0)
		b.consume_desired()
	assert_almost_eq(b.horizontal_speed(), MoveConst.MOVE_SPEED, 0.01,
		"straight-line ground speed converges to MOVE_SPEED")

func test_friction_decays_velocity_when_no_input_on_ground() -> void:
	var b := _grounded_body()
	b.move(Vector3(MoveConst.MOVE_SPEED, 0, 0))
	for i in range(30):
		b.step_horizontal(1.0 / 60.0)
		b.consume_desired()
	var moving_speed := b.horizontal_speed()
	b.move(Vector3.ZERO)  # release
	for i in range(120):
		b.step_horizontal(1.0 / 60.0)
		b.consume_desired()
	assert_lt(b.horizontal_speed(), moving_speed * 0.05, "friction bleeds speed to near zero")

func test_speed_cap_holds() -> void:
	var b := _grounded_body()
	b._vel_h = Vector3(1000, 0, 0)  # force over cap
	b.move(Vector3(MoveConst.MOVE_SPEED, 0, 0))
	b.step_horizontal(1.0 / 60.0)
	assert_almost_eq(b.horizontal_speed(), MoveConst.MAX_SPEED, 0.01, "clamped to MAX_SPEED")

func test_halt_zeroes_inertia() -> void:
	var b := _grounded_body()
	b._vel_h = Vector3(5, 0, 3)
	b.halt()
	assert_eq(b.horizontal_speed(), 0.0)
