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

func test_text_shadows_follow_the_css_lists() -> void:
	var pc := Color("#3377ff")
	var d := StreakFx.text_shadows(DOUBLE, pc, 0.0)
	assert_eq(d.size(), 1)
	assert_almost_eq(d[0]["blur"], 12.0, EPS)
	assert_eq(d[0]["color"], pc)
	var t := StreakFx.text_shadows(TRIPLE, pc, 0.0)
	assert_eq([t[0]["blur"], t[1]["blur"]], [14.0, 2.0])
	assert_eq(t[1]["color"], Color.WHITE)
	var s := StreakFx.text_shadows(SINGULARITY, pc, 0.0)
	assert_eq([s[0]["blur"], s[1]["blur"], s[2]["blur"]], [6.0, 18.0, 32.0])
	assert_eq(StreakFx.text_shadows("", pc, 0.0), [])
	assert_eq(StreakFx.text_color(DOUBLE, pc), pc)
	assert_eq(StreakFx.text_color(TRIPLE, pc), Color("#eaf4ff"))

func test_catalyst_glow_throbs() -> void:
	var pc := Color("#3377ff")
	var rest := StreakFx.text_shadows(CATALYST, pc, 0.0)
	assert_almost_eq(rest[0]["blur"], 8.0, EPS)
	assert_almost_eq(rest[1]["blur"], 2.0, EPS)
	assert_almost_eq((rest[2]["color"] as Color).a, 0.0, EPS, "the third glow only exists at the peak")
	var peak := StreakFx.text_shadows(CATALYST, pc, 0.8 * 0.5)
	assert_almost_eq(peak[0]["blur"], 18.0, EPS)
	assert_almost_eq(peak[1]["blur"], 6.0, EPS)
	assert_almost_eq(peak[2]["blur"], 30.0, EPS)
	assert_almost_eq((peak[2]["color"] as Color).a, 0.6, EPS, "color-mix(--pc 60%, transparent)")

func test_turbulence_filters_match_the_svg_defs() -> void:
	var el1 := StreakFx.filter_at(DOUBLE, 0.0)
	assert_eq(el1["frequency"], Vector2(0.0, 0.9))
	assert_almost_eq(el1["scale"], 3.0, EPS)
	assert_eq(el1["octaves"], 2)
	assert_eq(StreakFx.filter_at(DOUBLE, 1.5)["frequency"], Vector2(0.0, 0.55), "values a;b;a: b at half of 3 s")
	assert_almost_eq(StreakFx.filter_at(TRIPLE, 0.0)["scale"], 5.0, EPS)
	var el3 := StreakFx.filter_at(SINGULARITY, 0.0)
	assert_almost_eq(el3["scale"], 8.0, EPS)
	assert_eq(el3["octaves"], 3)
	assert_true(StreakFx.filter_at(CATALYST, 0.0).is_empty(), "catalyst has no filter")

func test_filter_region_leaves_room_for_the_glow() -> void:
	var box := Rect2(100.0, 50.0, 300.0, 28.0)
	var shadows := StreakFx.text_shadows(SINGULARITY, Color.WHITE, 0.0)
	var region := StreakFx.filter_region(box, shadows)
	var reach := CssShadow.padding(shadows)
	assert_true(region.encloses(box.grow(reach)), "the widest glow is never clipped")
	var ink := box.grow(reach)
	assert_almost_eq(region.size.y, ink.size.y * 1.2, EPS, "plus the SVG 10% margin each side")
	assert_eq(StreakFx.filter_region(box, []), box.grow_individual(30.0, 2.8, 30.0, 2.8), "no glow: box ±10%")

func test_spark_and_tick_layout_resolves_css_positions() -> void:
	var box := Vector2(300.0, 28.0)
	assert_eq(StreakFx.arc_position(0, box), Vector2(-12.0, 5.6), "top 20%, left -12px")
	assert_eq(StreakFx.arc_position(1, box), Vector2(292.0, 22.4), "right -12px, width 20")
	assert_eq(StreakFx.arc_position(2, box), Vector2(226.0, 2.24), "right 20%, width 14")
	assert_eq(StreakFx.tick_position(1, box), Vector2(120.0, 3.92), "left 40%, top 14%")

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
