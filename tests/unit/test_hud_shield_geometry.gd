extends GutTest
## Shield bracket arm geometry: each L is two non-overlapping rects, so a semi-transparent colour is not doubled at the
## vertex (web applies opacity to the arm group); square caps paint half a stroke past the vertex and the arm end.

const VERTEX := Vector2(24, 24)
const GROW_RIGHT_DOWN := Vector2(1, 1)
const GROW_LEFT_UP := Vector2(-1, -1)
const LENGTH := 40.0
const INSIDE := 0.5   # sample half a pixel inside an edge

func test_capped_arms_do_not_overlap_and_paint_the_corner() -> void:
	for sign in [GROW_RIGHT_DOWN, GROW_LEFT_UP]:
		var rects := HudShieldBrackets.arm_rects(VERTEX, sign, LENGTH, HudShieldBrackets.CAP)
		assert_eq(rects.size(), 2)
		assert_false(rects[0].intersects(rects[1]), "no doubled alpha at the vertex")
		var outer_corner: Vector2 = VERTEX - sign * (HudShieldBrackets.CAP - INSIDE)
		assert_true(rects[0].has_point(outer_corner) or rects[1].has_point(outer_corner), "square cap covers the corner")
		var arm_end: Vector2 = VERTEX + Vector2(sign.x * (LENGTH + HudShieldBrackets.CAP - INSIDE), 0.0)
		assert_true(rects[0].has_point(arm_end) or rects[1].has_point(arm_end), "square cap past the arm end")

func test_butt_track_arms_do_not_overlap() -> void:
	var rects := HudShieldBrackets.arm_rects(VERTEX, GROW_RIGHT_DOWN, HudModel.BRACKET_ARM, 0.0)
	assert_false(rects[0].intersects(rects[1]))
	assert_true(rects[0].has_point(VERTEX + Vector2(INSIDE, 0.0)) or rects[1].has_point(VERTEX + Vector2(INSIDE, 0.0)))

const SCREEN := Vector2(1280, 720)
const WEB_TOP_ARM_ROW := 21             # first pixel row of the top horizontal arms on the real-GPU web frame
const WEB_BOTTOM_ARM_ROW := 689         # first pixel row of the bottom horizontal arms (inline-SVG baseline gap)
const WEB_RIGHT_ARM_END_COLUMN := 1259  # one past the last pixel column of the right vertical arms

func test_vertices_land_on_the_web_pixel_rows_and_columns() -> void:
	var top_left := HudShieldBrackets.vertex_for(GROW_RIGHT_DOWN, SCREEN)
	var bottom_left := HudShieldBrackets.vertex_for(Vector2(1, -1), SCREEN)
	var top_right := HudShieldBrackets.vertex_for(Vector2(-1, 1), SCREEN)
	assert_eq(top_left.y - HudShieldBrackets.HALF, float(WEB_TOP_ARM_ROW))
	assert_eq(bottom_left.y - HudShieldBrackets.HALF, float(WEB_BOTTOM_ARM_ROW))
	assert_eq(top_right.x + HudShieldBrackets.HALF, float(WEB_RIGHT_ARM_END_COLUMN))
