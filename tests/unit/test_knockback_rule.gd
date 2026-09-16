extends GutTest
## KnockbackRule parity with web Match.maybeKnockback: two ball bodies closer than two radii push apart, one push per
## player per tick, never while its own push still runs, and on a mesh only for the players this peer simulates.

const EPS := 0.001
const TICK := 1.0 / 60.0
const APART := Vector3(3.0, 0.0, 0.0)

func _player(id: int, at: Vector3) -> Player:
	var player := Player.new()
	player.id = id
	player.body.set_position(at)
	return player

func test_overlapping_balls_push_apart() -> void:
	var left := _player(1, Vector3.ZERO)
	var right := _player(2, Vector3(MoveConst.BALL_RADIUS, 0.0, 0.0))
	KnockbackRule.apply([left, right])
	assert_true(left.body.is_knocking())
	assert_true(right.body.is_knocking())
	left.body.step_knockback(TICK)
	right.body.step_knockback(TICK)
	assert_lt(left.body.consume_desired().x, 0.0, "pushed away from the other centre")
	assert_gt(right.body.consume_desired().x, 0.0)

func test_balls_that_only_touch_are_left_alone() -> void:
	var one := _player(1, Vector3.ZERO)
	var two := _player(2, APART)
	KnockbackRule.apply([one, two])
	assert_false(one.body.is_knocking(), "web: the spheres have to overlap")

func test_the_push_is_not_restarted_while_it_runs() -> void:
	# web: `knocking` skips the player, so staying inside the other ball does not stack push on push.
	var one := _player(1, Vector3.ZERO)
	var two := _player(2, Vector3(MoveConst.BALL_RADIUS, 0.0, 0.0))
	KnockbackRule.apply([one, two])
	one.body.step_knockback(TICK)
	var first := one.body.consume_desired().length()
	KnockbackRule.apply([one, two])
	one.body.step_knockback(TICK)
	assert_almost_eq(one.body.consume_desired().length(), first, EPS, "one push, not two stacked")

func test_the_dead_neither_push_nor_are_pushed() -> void:
	var alive := _player(1, Vector3.ZERO)
	var ghost := _player(2, Vector3(MoveConst.BALL_RADIUS, 0.0, 0.0))
	ghost.alive = false
	KnockbackRule.apply([alive, ghost])
	assert_false(alive.body.is_knocking())
	assert_false(ghost.body.is_knocking())

func test_centres_on_top_of_each_other_pick_an_axis() -> void:
	var one := _player(1, Vector3.ZERO)
	var two := _player(2, Vector3.ZERO)
	KnockbackRule.apply([one, two])
	one.body.step_knockback(TICK)
	assert_almost_eq(one.body.consume_desired().normalized().x, KnockbackRule.FALLBACK_DIR.x, EPS)

func test_a_peer_only_pushes_the_players_it_simulates() -> void:
	var mine := _player(1, Vector3.ZERO)
	var theirs := _player(2, Vector3(MoveConst.BALL_RADIUS, 0.0, 0.0))
	KnockbackRule.apply([mine, theirs], func(id: int) -> bool: return id == mine.id)
	assert_true(mine.body.is_knocking())
	assert_false(theirs.body.is_knocking(), "their owner pushes them on its own screen")
