extends GutTest
## A ball on the menu stage — web MenuBackdrop StageBall: invisible through the warm-up frames, then fading in
## (tau 0.13 s) while it un-shrinks over 125 ms, and fading / shrinking out over 250 ms when it leaves.

const EPS := 0.0001
const DT := 1.0 / 60.0

func test_warm_up_keeps_the_ball_invisible() -> void:
	var ball := MenuStageBall.new()
	for i in MenuStageBall.WARMUP_FRAMES - 1:
		ball.step(DT, false)
		assert_almost_eq(ball.opacity, 0.0, EPS, "shaders compile behind opacity 0")
	ball.step(DT, false)
	assert_almost_eq(ball.opacity, 0.0, EPS, "the last warm-up frame still holds")
	assert_almost_eq(ball.scale, MenuStageBall.MIN_SCALE, EPS)

func test_fade_and_spawn_after_warm_up() -> void:
	var ball := MenuStageBall.new()
	for i in MenuStageBall.WARMUP_FRAMES:
		ball.step(DT, false)
	ball.step(DT, false)
	assert_almost_eq(ball.opacity, 1.0 - exp(-DT / MenuStageBall.FADE_TAU), EPS, "first visible frame")
	assert_almost_eq(ball.scale, MenuStageBall.MIN_SCALE, EPS, "web: the first frame's spawn age is 0")
	ball.step(DT, false)
	assert_almost_eq(ball.scale, DT * 1000.0 / MenuStageBall.SPAWN_MS, EPS, "un-shrinks over 125 ms")
	for i in 60:
		ball.step(DT, false)
	assert_almost_eq(ball.scale, 1.0, EPS)
	assert_gt(ball.opacity, 0.99, "about eight fade taus later")

func test_leaving_shrinks_out() -> void:
	var ball := MenuStageBall.new()
	for i in 60:
		ball.step(DT, false)
	ball.step(0.1, true)
	assert_almost_eq(ball.scale, 1.0 - 100.0 / MenuStageBall.EXIT_SHRINK_MS, EPS)
	assert_lt(ball.opacity, 1.0)
