extends GutTest
## Chrome's dashed border (measured on the web lobby seats, 2 px dashed, radius 7): dashes three widths long, gaps
## about two, the count fitted to each side's straight run so the dashes spread evenly and the corners stay clear.

const EPS := 0.01
const WIDTH := 2.0
const RADIUS := 7.0
const SEAT := Vector2(263.1, 108.0)

func test_dash_counts_match_the_web_seat() -> void:
	assert_eq(CssDashedBorder.dashes(SEAT.x, WIDTH, RADIUS).size(), 26, "top / bottom edge of a 263 px seat")
	assert_eq(CssDashedBorder.dashes(SEAT.y, WIDTH, RADIUS).size(), 10, "left / right edge of a 108 px seat")

func test_dashes_spread_evenly_between_the_corners() -> void:
	var dashes := CssDashedBorder.dashes(SEAT.x, WIDTH, RADIUS)
	var first: Vector2 = dashes[0]
	var last: Vector2 = dashes[dashes.size() - 1]
	assert_almost_eq(first.x, SEAT.x - last.y, EPS, "symmetric: the run starts and ends the same distance in")
	assert_true(first.x >= RADIUS - WIDTH, "the rounded corner stays clear")
	for dash in dashes:
		assert_almost_eq(dash.y - dash.x, CssDashedBorder.DASH_WIDTHS * WIDTH, EPS, "every dash three widths long")
	var gap: float = dashes[1].x - dashes[0].y
	for i in range(1, dashes.size()):
		assert_almost_eq(dashes[i].x - dashes[i - 1].y, gap, EPS, "equal gaps")

func test_a_short_edge_still_gets_one_dash() -> void:
	assert_eq(CssDashedBorder.dashes(RADIUS * 2.0 + 1.0, WIDTH, RADIUS).size(), 1)
