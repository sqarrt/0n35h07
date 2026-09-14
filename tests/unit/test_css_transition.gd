extends GutTest
## CssTransition: linear by default, eased by a cubic-bezier curve when given one.

const DURATION_S := 0.4
const HALF := 0.5
const EASE := [0.25, 0.1, 0.25, 1.0]
const EPS := 0.0001

func test_a_linear_transition_moves_evenly() -> void:
	var transition := CssTransition.new(DURATION_S)
	transition.set_target(1.0)
	transition.advance(DURATION_S * HALF)
	assert_almost_eq(transition.value, HALF, EPS)
	transition.advance(DURATION_S)
	assert_eq(transition.value, 1.0)

func test_a_curved_transition_follows_its_timing_function() -> void:
	var transition := CssTransition.new(DURATION_S, EASE)
	transition.snap(1.0)
	transition.set_target(0.0)
	transition.advance(DURATION_S * HALF)
	assert_almost_eq(transition.value, 1.0 - CssTiming.cubic_bezier(HALF, EASE), EPS)
	transition.advance(DURATION_S)
	assert_eq(transition.value, 0.0)
