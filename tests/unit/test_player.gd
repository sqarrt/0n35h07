extends GutTest

func test_move_intent_reaches_body_when_active() -> void:
	var p := Player.new()
	p.body.grounded = true
	p.move_intent(Vector3(MoveConst.MOVE_SPEED, 0, 0))
	p.body.step_horizontal(1.0 / 60.0)
	assert_gt(p.body.consume_desired().x, 0.0)

func test_frozen_blocks_movement_and_halts() -> void:
	var p := Player.new()
	p.body.grounded = true
	p.body._vel_h = Vector3(5, 0, 0)
	p.set_frozen(true)
	assert_eq(p.body.horizontal_speed(), 0.0, "freeze halts inertia")
	p.move_intent(Vector3(MoveConst.MOVE_SPEED, 0, 0))
	p.body.step_horizontal(1.0 / 60.0)
	assert_almost_eq(p.body.consume_desired().length(), 0.0, 1e-6, "no movement while frozen")

func test_frozen_blocks_dash() -> void:
	var p := Player.new()
	p.set_frozen(true)
	assert_false(p.dash(Vector3(1, 0, 0)))

func test_set_look_ignores_near_zero() -> void:
	var p := Player.new()
	var before := p.look_dir()
	p.set_look(Vector3.ZERO)
	assert_eq(p.look_dir(), before, "near-zero look is ignored")
	p.set_look(Vector3(0, 0, 1))
	assert_eq(p.look_dir(), Vector3(0, 0, 1))
