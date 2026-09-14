extends GutTest
## The photosensitivity warning's clock against web EpilepsyWarning + theme.css: content-in 320 ms ease, the hint and
## the click unlocked at 1500 ms (240 ms ease), the planet breathing 0.13 → 0.24 → 0.13 over 4 s ease-in-out, the
## screen fading out over 280 ms ease after the click.

const EPS := 0.0001
const HALF := 0.5

func test_content_fades_in() -> void:
	assert_eq(WarningTimeline.content_opacity(0.0), 0.0)
	assert_almost_eq(WarningTimeline.content_opacity(WarningTimeline.CONTENT_IN_MS * HALF),
		CssTiming.cubic_bezier(HALF, CssTiming.EASE), EPS)
	assert_eq(WarningTimeline.content_opacity(WarningTimeline.CONTENT_IN_MS), 1.0)
	assert_eq(WarningTimeline.content_opacity(WarningTimeline.HINT_DELAY_MS), 1.0)

func test_the_hint_and_the_click_wait_for_the_warm_up() -> void:
	assert_false(WarningTimeline.can_dismiss(WarningTimeline.HINT_DELAY_MS - 1.0))
	assert_true(WarningTimeline.can_dismiss(WarningTimeline.HINT_DELAY_MS))
	assert_eq(WarningTimeline.hint_opacity(WarningTimeline.HINT_DELAY_MS - 1.0), 0.0)
	assert_almost_eq(WarningTimeline.hint_opacity(WarningTimeline.HINT_DELAY_MS + WarningTimeline.HINT_FADE_MS * HALF),
		CssTiming.cubic_bezier(HALF, CssTiming.EASE), EPS)
	assert_eq(WarningTimeline.hint_opacity(WarningTimeline.HINT_DELAY_MS + WarningTimeline.HINT_FADE_MS), 1.0)

func test_the_planet_breathes() -> void:
	assert_almost_eq(WarningTimeline.planet_opacity(0.0), 0.13, EPS)
	assert_almost_eq(WarningTimeline.planet_opacity(1000.0),
		lerpf(0.13, 0.24, CssTiming.cubic_bezier(HALF, CssTiming.EASE_IN_OUT)), EPS, "halfway to the peak")
	assert_almost_eq(WarningTimeline.planet_opacity(2000.0), 0.24, EPS, "50% of the 4 s cycle")
	assert_almost_eq(WarningTimeline.planet_opacity(4000.0), 0.13, EPS, "the cycle repeats")

func test_the_screen_fades_out_after_the_click() -> void:
	assert_eq(WarningTimeline.screen_opacity(0.0), 1.0)
	assert_almost_eq(WarningTimeline.screen_opacity(WarningTimeline.FADE_OUT_MS * HALF),
		1.0 - CssTiming.cubic_bezier(HALF, CssTiming.EASE), EPS)
	assert_false(WarningTimeline.is_gone(WarningTimeline.FADE_OUT_MS - 1.0))
	assert_true(WarningTimeline.is_gone(WarningTimeline.FADE_OUT_MS))
