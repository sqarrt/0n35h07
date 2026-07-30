extends GutTest

func _const_rng(v: float) -> Callable:
	return func() -> float: return v

func test_roll_hit_respects_rng() -> void:
	assert_true(BotAim.roll_hit(0.5, _const_rng(0.1)), "0.1 < 0.5 -> hit")
	assert_false(BotAim.roll_hit(0.5, _const_rng(0.9)), "0.9 >= 0.5 -> miss")

func test_aim_hit_is_center() -> void:
	var base := Vector3(0, 1.7, -5)
	assert_eq(BotAim.aim_point(base, Vector3(0, 1.7, 0), true, 0.5, _const_rng(0.25)), base)

func test_aim_miss_is_perpendicular_graze() -> void:
	var base := Vector3(0, 1.7, -5)
	var shooter := Vector3(0, 1.7, 0)
	var graze := 0.5
	var out := BotAim.aim_point(base, shooter, false, graze, _const_rng(0.1))
	var offset := out - base
	var dir := (base - shooter).normalized()
	assert_almost_eq(offset.dot(dir), 0.0, 1e-4, "offset perpendicular to line of fire")
	assert_almost_eq(offset.length(), MoveConst.BALL_RADIUS * (1.0 + graze), 1e-4, "offset = BALL_RADIUS*(1+graze)")
