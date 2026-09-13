extends GutTest
## CSS shadow maths shared by the glow nodes: blur radius -> Gaussian sigma (css-backgrounds-3: sigma = B / 2), how far a
## shadow reaches past its box, and shadow-list interpolation (shorter list padded with transparent, premultiplied).

const EPS := 0.001

func test_blur_radius_is_twice_the_sigma() -> void:
	assert_almost_eq(CssShadow.sigma(12.0), 6.0, EPS)
	assert_almost_eq(CssShadow.sigma(0.0), 0.0, EPS)

func test_padding_covers_three_sigmas_plus_the_offset() -> void:
	var glow := CssShadow.make(12.0, Color.WHITE)
	var shifted := CssShadow.make(2.0, Color.WHITE, Vector2(-1.0, 0.0))
	assert_eq(CssShadow.reach_px(glow), 18, "3 sigma of a 12px blur")
	assert_eq(CssShadow.reach_px(shifted), 4, "3 px of blur + 1 px offset")
	assert_eq(CssShadow.padding([glow, shifted]), 18)
	assert_eq(CssShadow.padding([]), 0)

func test_premultiplied_colour_interpolation() -> void:
	var pc := Color("#3377ff")
	var half := CssShadow.lerp_color(Color(0, 0, 0, 0), Color(pc, 0.6), 0.5)
	assert_almost_eq(half.a, 0.3, EPS, "alpha interpolates")
	assert_almost_eq(half.b, pc.b, EPS, "colour does not darken towards transparent black")
	var mid := CssShadow.lerp_color(Color.WHITE, Color.BLACK, 0.5)
	assert_almost_eq(mid.r, 0.5, EPS)

func test_shadow_lists_interpolate_with_transparent_padding() -> void:
	var pc := Color("#3377ff")
	var a := [CssShadow.make(8.0, pc), CssShadow.make(2.0, Color.WHITE)]
	var b := [CssShadow.make(18.0, pc), CssShadow.make(6.0, Color.WHITE), CssShadow.make(30.0, Color(pc, 0.6))]
	var mid := CssShadow.lerp_lists(a, b, 0.5)
	assert_eq(mid.size(), 3)
	assert_almost_eq(mid[0]["blur"], 13.0, EPS)
	assert_almost_eq(mid[1]["blur"], 4.0, EPS)
	assert_almost_eq(mid[2]["blur"], 15.0, EPS, "the padded shadow grows from 0 px")
	assert_almost_eq((mid[2]["color"] as Color).a, 0.3, EPS)
