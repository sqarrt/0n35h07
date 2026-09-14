extends GutTest
## The trailer's text cut against theme.css @keyframes trailer-cut-text / trailer-cut-bar.

const EPS := 0.001
const HALF := 0.5
const SPLIT_SHADOWS := 3
const SKEW_DEG := 45.0
const BOX_POSITION := Vector2(100.0, 50.0)
const BOX_SIZE := Vector2(400.0, 80.0)
const OFFSET_X := 10.0

func test_the_text_slams_in_holds_and_flies_off() -> void:
	var start := TrailerCut.text(0.0)
	assert_eq(start["opacity"], 0.0)
	assert_eq(start["offset_x"], -70.0, "translateX(-70px)")
	assert_eq(start["skew"], -20.0, "skewX(-20deg)")
	assert_eq(start["spacing"], 0.5, "letter-spacing 0.5em")
	var slam := TrailerCut.text(0.13)
	assert_eq(slam["opacity"], 1.0)
	assert_eq(slam["offset_x"], 0.0)
	assert_eq(slam["spacing"], TrailerCut.TEXT_SPACING_EM)
	assert_almost_eq(float(TrailerCut.text(0.065)["opacity"]), CssTiming.cubic_bezier(HALF, TrailerCut.CURVE), EPS,
		"each segment eased by cubic-bezier(.2, 1, .3, 1)")
	var hold := TrailerCut.text(HALF)
	assert_eq(hold["offset_x"], 0.0)
	assert_eq(hold["skew"], 0.0)
	var end := TrailerCut.text(1.0)
	assert_eq(end["opacity"], 0.0)
	assert_eq(end["offset_x"], 70.0)
	assert_eq(end["skew"], 14.0)

func test_the_split_shadow_flashes_on_the_jolts() -> void:
	var slam := TrailerCut.shadows(0.13)
	assert_eq(slam.size(), SPLIT_SHADOWS)
	assert_eq(slam[0]["offset"], Vector2(TrailerCut.CHROMA_OFFSET_PX, 0.0), "red to the right")
	assert_eq(slam[1]["offset"], Vector2(-TrailerCut.CHROMA_OFFSET_PX, 0.0), "cyan to the left")
	assert_eq(slam[2]["blur"], TrailerCut.GLOW_BLUR)
	var settled := TrailerCut.shadows(0.22)
	assert_eq(settled.size(), SPLIT_SHADOWS, "padded: the glow layers never rebuild")
	assert_eq(settled[0]["blur"], TrailerCut.GLOW_BLUR, "only the element's own glow")
	assert_eq(settled[1]["color"].a, 0.0)
	var local := (HALF - 0.22) / (0.88 - 0.22)
	assert_almost_eq(float(TrailerCut.shadows(HALF)[0]["blur"]),
		lerpf(TrailerCut.GLOW_BLUR, 0.0, CssTiming.cubic_bezier(local, TrailerCut.CURVE)), EPS,
		"no keyframe between 22% and 88% sets the shadow: the split eases back in across the hold")
	assert_eq(TrailerCut.shadows(0.88)[0]["color"], TrailerCut.CHROMA_RED)

func test_the_transform_skews_about_the_box_centre() -> void:
	var transform := TrailerCut.text_transform(OFFSET_X, SKEW_DEG, BOX_POSITION, BOX_SIZE)
	var centre := BOX_SIZE * HALF
	assert_true((transform * centre).is_equal_approx(BOX_POSITION + centre + Vector2(OFFSET_X, 0.0)),
		"transform-origin 50% 50% stays put (then translateX)")
	assert_true((transform * Vector2.ZERO).is_equal_approx(BOX_POSITION + Vector2(OFFSET_X - centre.y, 0.0)),
		"skewX(45deg) leans the top edge left by half the height")

func test_the_bar_sweeps_open_and_fades() -> void:
	assert_eq(TrailerCut.bar(0.0)["scale"], 0.0)
	var open := TrailerCut.bar(TrailerCut.BAR_S * 0.6)
	assert_eq(open["scale"], 1.0)
	assert_eq(open["opacity"], 1.0)
	assert_eq(TrailerCut.bar(TrailerCut.BAR_S)["opacity"], 0.0)
	assert_eq(TrailerCut.bar(TrailerCut.BAR_S * 2.0)["opacity"], 0.0, "stays gone (forwards)")
