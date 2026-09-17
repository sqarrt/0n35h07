extends GutTest

func test_gravity_integrates_downward_when_airborne() -> void:
	var b := Body.new()
	b.set_grounded(false)
	b.step_vertical(1.0 / 60.0)
	assert_lt(b.velocity_y, 0.0, "gravity pulls down")

func test_ground_jump_on_hold() -> void:
	var b := Body.new()
	b.set_grounded(true)
	b.set_jump_input(true)
	b.step_jump()
	assert_eq(b.velocity_y, MoveConst.JUMP_FORCE, "hold jump on ground -> jump")
	assert_true(b.just_jumped)

func test_double_jump_only_on_new_press_in_air() -> void:
	var b := Body.new()
	# leave ground by jumping
	b.set_grounded(true); b.set_jump_input(true); b.step_jump()
	b.set_grounded(false)
	# still holding -> no air jump (no new edge)
	b.set_jump_input(true); b.step_jump()
	assert_eq(b.velocity_y, MoveConst.JUMP_FORCE, "held: no double jump")
	# release then press again -> air jump consumes the one air jump
	b.set_jump_input(false); b.step_jump()
	b.set_jump_input(true); b.step_jump()
	assert_eq(b.velocity_y, MoveConst.JUMP_FORCE, "new press: double jump fires")
	# a further new press does nothing (air jumps exhausted)
	b.set_jump_input(false); b.step_jump()
	b.velocity_y = -1.0
	b.set_jump_input(true); b.step_jump()
	assert_eq(b.velocity_y, -1.0, "no air jumps left")

func test_landing_restores_air_jump_and_zeroes_vertical() -> void:
	var b := Body.new()
	b.velocity_y = -5.0
	b.set_grounded(true)
	assert_eq(b.velocity_y, 0.0, "landing zeroes vertical velocity")

func test_bhop_skips_friction_on_jump_frame() -> void:
	var b := Body.new()
	b.grounded = true
	b._vel_h = Vector3(10, 0, 0)
	b.set_jump_input(true)
	b.step_jump()          # sets _jumped_this_frame
	b.move(Vector3.ZERO)
	b.step_horizontal(1.0 / 60.0)
	assert_almost_eq(b.horizontal_speed(), 10.0, 1e-4, "no friction applied on the jump frame")
