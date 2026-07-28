extends GutTest
## Guards the ported movement numbers against typos/drift vs the web reference.

func test_core_values_match_web() -> void:
	assert_eq(MoveConst.MOVE_SPEED, 7.0)
	assert_eq(MoveConst.GRAVITY, -22.0)
	assert_eq(MoveConst.JUMP_FORCE, 8.0)
	assert_eq(MoveConst.MAX_AIR_JUMPS, 1)
	assert_eq(MoveConst.GROUND_ACCEL, 16.0)
	assert_eq(MoveConst.GROUND_FRICTION, 12.0)
	assert_eq(MoveConst.AIR_ACCEL, 30.0)
	assert_eq(MoveConst.AIR_WISH_SPEED, 1.0)
	assert_eq(MoveConst.MAX_SPEED, 42.0)
	assert_eq(MoveConst.DASH_SPEED, 24.0)
	assert_eq(MoveConst.DASH_DURATION_MS, 150.0)
	assert_eq(MoveConst.DASH_COOLDOWN_MS, 1500.0)
