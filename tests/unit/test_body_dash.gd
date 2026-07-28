extends GutTest

func test_dash_starts_and_moves_along_dir() -> void:
	var b := Body.new()
	assert_true(b.dash(Vector3(1, 0, 0)), "dash starts when ready")
	assert_true(b.is_dashing())
	b.step_dash(1.0 / 60.0)
	var d := b.consume_desired()
	assert_gt(d.x, 0.0, "dash pushes along +X")

func test_dash_blocked_during_cooldown() -> void:
	var b := Body.new()
	assert_true(b.dash(Vector3(1, 0, 0)))
	assert_false(b.dash(Vector3(0, 0, 1)), "second dash blocked by cooldown")

func test_dash_ignores_zero_direction() -> void:
	var b := Body.new()
	assert_false(b.dash(Vector3.ZERO))

func test_dash_progress_ready_is_one() -> void:
	var b := Body.new()
	assert_eq(b.dash_progress(), 1.0)
	b.dash(Vector3(1, 0, 0))
	assert_lt(b.dash_progress(), 1.0, "progress drops during cooldown")

func test_dash_timer_expires() -> void:
	var b := Body.new()
	b.dash(Vector3(1, 0, 0))
	for i in range(20):  # 20/60 s ~ 333ms > 150ms window
		b.step_dash(1.0 / 60.0)
		b.consume_desired()
	assert_false(b.is_dashing(), "dash window closes after DASH_DURATION_MS")
