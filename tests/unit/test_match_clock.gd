extends GutTest
## Match clock parity with web Match.tickMatchClock: starts on the first live tick, counts down to zero, then ends.

const MS_PER_S := 1000.0
const DURATION_MS := 3000.0
const HALF_SECOND := 0.5
const ONE_SECOND := 1.0
const ALMOST_ALL := 2.999        # seconds: 1 ms short of DURATION_MS
const EPS := 0.001

func test_does_not_run_before_live() -> void:
	var c := MatchClock.new(DURATION_MS)
	c.update(ONE_SECOND, false)
	assert_eq(c.remaining_ms(), DURATION_MS, "countdown/ready phases do not consume match time")
	assert_false(c.is_over())

func test_counts_down_while_live_and_rounds_seconds_up() -> void:
	var c := MatchClock.new(DURATION_MS)
	c.update(HALF_SECOND, true)
	assert_almost_eq(c.remaining_ms(), DURATION_MS - HALF_SECOND * MS_PER_S, EPS)
	assert_eq(c.seconds_left(), int(ceil(DURATION_MS / MS_PER_S)), "web shows Math.ceil(remaining / 1000)")

func test_is_over_exactly_when_time_runs_out() -> void:
	var c := MatchClock.new(DURATION_MS)
	c.update(ALMOST_ALL, true)
	assert_false(c.is_over(), "1 ms left")
	assert_eq(c.seconds_left(), 1)
	c.update(ONE_SECOND, true)
	assert_true(c.is_over())
	assert_eq(c.remaining_ms(), 0.0, "remaining clamps at zero")
	assert_eq(c.seconds_left(), 0)

func test_zero_duration_means_no_timer() -> void:
	var c := MatchClock.new(0.0)
	c.update(DURATION_MS, true)
	assert_false(c.has_timer())
	assert_false(c.is_over(), "web durationMs 0: the match never ends on time")
