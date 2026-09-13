extends GutTest
## Streak text effect parity with web EffectText + theme.css .fx rules: per-kind style table, CSS keyframes sampled at
## their key times (exact regardless of easing), spark / tick flash windows, glitch bands and the SINGULARITY scramble.

const EPS := 0.001
const DOUBLE := "double"
const TRIPLE := "triple"
const SINGULARITY := "singularity"
const CATALYST := "catalyst"

func test_style_table_matches_the_web_css() -> void:
	var d := StreakFx.style(DOUBLE)
	assert_eq(d["color_rule"], StreakFx.COLOR_PLAYER, "double text is the player colour")
	assert_true(d["glitch"])
	assert_eq(d["glitch_periods_s"], [2.1, 2.5])
	assert_eq(d["anim"], StreakFx.ANIM_FLICK)
	assert_almost_eq(d["anim_period_s"], 2.4, EPS)
	assert_eq([d["arcs"], d["ticks"]], [3, 0])
	var t := StreakFx.style(TRIPLE)
	assert_eq(t["color"], Color("#eaf4ff"))
	assert_eq(t["glitch_periods_s"], [1.2, 1.0])
	assert_eq(t["anim"], StreakFx.ANIM_JITTER)
	assert_almost_eq(t["anim_period_s"], 0.18, EPS)
	var s := StreakFx.style(SINGULARITY)
	assert_eq(s["color"], Color.WHITE)
	assert_eq(s["glitch_periods_s"], [0.55, 0.5])
	assert_eq(s["anim"], StreakFx.ANIM_BURN)
	assert_true(s["scramble"])
	var c := StreakFx.style(CATALYST)
	assert_eq(c["color"], Color.WHITE)
	assert_false(c["glitch"], "catalyst has no chroma split")
	assert_eq(c["anim"], StreakFx.ANIM_THROB)
	assert_almost_eq(c["anim_period_s"], 0.8, EPS)
	assert_eq([c["arcs"], c["ticks"]], [5, 3])
	assert_true(StreakFx.style("").is_empty(), "no kind -> plain text")

func test_double_flicker_keyframes() -> void:
	var period := 2.4
	assert_almost_eq(StreakFx.flick_opacity(0.0), 1.0, EPS)
	assert_almost_eq(StreakFx.flick_opacity(period * 0.5), 0.85, EPS)
	assert_almost_eq(StreakFx.flick_opacity(period * 0.51), 1.0, EPS)
	assert_almost_eq(StreakFx.flick_opacity(period * 0.8), 0.55, EPS)
	assert_almost_eq(StreakFx.flick_opacity(period * 1.5), 0.85, EPS, "infinite: the second cycle repeats")

func test_movement_keyframes_for_triple_and_singularity() -> void:
	assert_eq(StreakFx.jitter_offset(0.18 * 0.25), Vector2(0.6, -0.4))
	var burn := StreakFx.burn_transform(0.9 * 0.4)
	assert_eq(burn["offset"], Vector2(-1.0, 0.6))
	assert_almost_eq(burn["scale"], 1.03, EPS)

func test_catalyst_glow_throbs() -> void:
	assert_almost_eq(StreakFx.throb_glow_px(0.0), 8.0, EPS)
	assert_almost_eq(StreakFx.throb_glow_px(0.8 * 0.5), 18.0, EPS)

func test_spark_and_tick_flash_windows() -> void:
	var period := 0.5
	var delay := 0.12
	assert_almost_eq(StreakFx.crack_opacity(delay + period * 0.5, period, delay), 1.0, EPS, "ks-crack peak at 50%")
	assert_almost_eq(StreakFx.crack_opacity(delay + period * 0.3, period, delay), 0.0, EPS)
	assert_almost_eq(StreakFx.crack_opacity(delay + period * 0.6, period, delay), 0.0, EPS)
	assert_almost_eq(StreakFx.crack_opacity(delay * 0.5, period, delay), 0.0, EPS, "hidden before the delay")
	assert_almost_eq(StreakFx.tick_opacity(period * 0.73, period, 0.0), 1.0, EPS, "ks-tick peak at 73%")
	assert_almost_eq(StreakFx.tick_opacity(period * 0.5, period, 0.0), 0.0, EPS)

func test_glitch_band_keyframes() -> void:
	var band := StreakFx.glitch_band_a(0.0, 2.1)
	assert_almost_eq(band["top"], 0.0, EPS)
	assert_almost_eq(band["bottom"], 0.85, EPS)
	assert_almost_eq(band["shift_px"], 0.0, EPS)
	band = StreakFx.glitch_band_a(2.1 * 0.2, 2.1)
	assert_almost_eq(band["top"], 0.2, EPS)
	assert_almost_eq(band["bottom"], 0.55, EPS)
	assert_almost_eq(band["shift_px"], -2.0, EPS)

func test_scramble_follows_the_web_random_calls() -> void:
	var always_low := func() -> float: return 0.0
	var always_high := func() -> float: return 0.9
	assert_eq(StreakFx.scramble("AB: 12", always_low), "##: ##", "chance hit -> SCRAMBLE[0], punctuation kept")
	assert_eq(StreakFx.scramble("AB: 12", always_high), "AB: 12", "no hit -> unchanged")
	assert_eq(StreakFx.SCRAMBLE_CHARS, "#@%&$/\\|<>*+=")
	assert_almost_eq(StreakFx.SCRAMBLE_CHANCE, 0.4, EPS)
	assert_eq(StreakFx.SCRAMBLE_MS, 240.0)
	assert_eq(StreakFx.SCRAMBLE_FLASH_MS, 90.0)
