extends GutTest
## Body.knockback parity with web: the horizontal share bursts into `desired` for KNOCKBACK_DURATION, the upward share
## overrides the fall (it does not add up), and the window runs out on its own.

const EPS := 0.001
const TICK := 1.0 / 60.0
const FALL_SPEED := -5.0
const STEEP_UP := Vector3(0.0, 1.0, 0.0)

func test_the_push_rides_in_desired_for_its_window() -> void:
	var body := Body.new()
	body.knockback(Vector3.RIGHT)
	var travelled := 0.0
	for i in ceili(MoveConst.KNOCKBACK_DURATION_MS / 1000.0 / TICK):
		body.step_knockback(TICK)
		travelled += body.consume_desired().x
	assert_almost_eq(travelled, MoveConst.KNOCKBACK_SPEED * MoveConst.KNOCKBACK_DURATION_MS / 1000.0, 0.1)
	assert_false(body.is_knocking(), "the window runs out")
	body.step_knockback(TICK)
	assert_almost_eq(body.consume_desired().x, 0.0, EPS)

func test_only_the_horizontal_share_pushes_sideways() -> void:
	var body := Body.new()
	body.knockback(STEEP_UP)
	body.step_knockback(TICK)
	assert_almost_eq(body.consume_desired().length(), 0.0, EPS, "straight from below: nothing sideways")
	assert_almost_eq(body.velocity_y, MoveConst.KNOCKBACK_UP_SPEED, EPS)

func test_the_lift_overrides_a_fall_instead_of_adding_to_it() -> void:
	var body := Body.new()
	body.velocity_y = FALL_SPEED
	body.knockback(STEEP_UP)
	assert_almost_eq(body.velocity_y, MoveConst.KNOCKBACK_UP_SPEED, EPS, "web Math.max, not +=")
	body.velocity_y = MoveConst.KNOCKBACK_UP_SPEED * 2.0
	body.knockback(STEEP_UP)
	assert_almost_eq(body.velocity_y, MoveConst.KNOCKBACK_UP_SPEED * 2.0, EPS, "a faster rise is kept")

func test_a_push_from_above_never_drags_the_body_down() -> void:
	var body := Body.new()
	body.knockback(Vector3(0.0, -1.0, 0.0))
	assert_almost_eq(body.velocity_y, 0.0, EPS, "web: only dir.y > 0 becomes an impulse")

func test_a_teleport_clears_the_push() -> void:
	var body := Body.new()
	body.knockback(Vector3.RIGHT)
	body.set_position(Vector3(1.0, MoveConst.EYE_HEIGHT, 1.0))
	assert_false(body.is_knocking(), "a respawn carries no impulse over")
