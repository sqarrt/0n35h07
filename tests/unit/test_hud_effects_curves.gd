extends GutTest
## HUD animation curves parity with web CSS: streak banner flicker (ks-annShow, steps(1,end)), countdown pop
## (cdPop, ease-out), ghost bar width and windup vignette opacity.

const EPS := 0.005
const BANNER_S := 2.05                    # web ks-annShow duration
const HALF := 0.5
const EASE_OUT_AT_HALF := 0.684           # cubic-bezier(0, 0, 0.58, 1) at x = 0.5 (solved numerically)

func _banner_at(percent: float) -> float:
	return HudModel.banner_opacity(BANNER_S * percent / 100.0)

func test_banner_flicker_holds_each_keyframe_until_the_next() -> void:
	assert_almost_eq(_banner_at(1.0), 0.0, EPS, "0% keyframe")
	assert_almost_eq(_banner_at(2.5), 0.25, EPS, "2%")
	assert_almost_eq(_banner_at(3.5), 1.0, EPS, "3%")
	assert_almost_eq(_banner_at(4.5), 0.4, EPS, "4%")
	assert_almost_eq(_banner_at(50.0), 1.0, EPS, "5% .. 90%")
	assert_almost_eq(_banner_at(95.0), 1.0, EPS, "90%")
	assert_almost_eq(_banner_at(99.0), 0.5, EPS, "98%")
	assert_almost_eq(HudModel.banner_opacity(BANNER_S), 0.0, EPS, "gone at the end")
	assert_eq(HudModel.BANNER_DURATION_S, BANNER_S)

func test_css_ease_out_curve() -> void:
	assert_almost_eq(HudModel.css_ease_out(0.0), 0.0, EPS)
	assert_almost_eq(HudModel.css_ease_out(HALF), EASE_OUT_AT_HALF, EPS)
	assert_almost_eq(HudModel.css_ease_out(1.0), 1.0, EPS)

func test_countdown_pop_scales_down_and_fades_in() -> void:
	var start := HudModel.countdown_pop(0.0)
	assert_almost_eq(start["scale"], 1.6, EPS)
	assert_almost_eq(start["opacity"], 0.0, EPS)
	assert_almost_eq(HudModel.countdown_pop(0.25)["opacity"], 1.0, EPS, "fully visible at 25%")
	var end := HudModel.countdown_pop(1.0)
	assert_almost_eq(end["scale"], 1.0, EPS)
	assert_almost_eq(end["opacity"], 0.9, EPS)
	assert_almost_eq(HudModel.countdown_pop(HALF)["scale"], 1.6 - 0.6 * EASE_OUT_AT_HALF, EPS, "one ease-out segment")

func test_ghost_bars_and_windup_vignette_follow_progress() -> void:
	assert_almost_eq(HudModel.ghost_bar_width_share(1.0), 0.5, EPS, "full bar = half the screen")
	assert_almost_eq(HudModel.ghost_bar_width_share(HALF), 0.25, EPS)
	assert_almost_eq(HudModel.windup_vignette_opacity(HALF), HALF, EPS)
	assert_almost_eq(HudModel.windup_vignette_opacity(2.0), 1.0, EPS, "clamped")

func test_banner_text_names_the_player() -> void:
	assert_eq(HudModel.banner_text("OR8773R", "CATALYST"), "OR8773R: CATALYST")
