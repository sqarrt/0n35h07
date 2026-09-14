extends GutTest
## EffectText node parity with web EffectText.tsx: plain text without a kind; per kind the text colour, glows,
## glitch copies, sparks / ticks, the turbulence filter, the whole-element animation and the SINGULARITY scramble.

const SCREEN := Vector2i(1280, 720)
const EPS := 0.001
const FONT_SIZE := 24
const SPACING_EM := 0.18
const PLAIN := Color("#8a93a0")
const PC := Color("#3377ff")
const TEXT := "YOU: DOUBLE KILL"

func _fx() -> EffectText:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var fx := EffectText.new()
	screen.add_child(fx)
	fx.configure(UiFont.spaced(0.18, FONT_SIZE), FONT_SIZE, PLAIN)
	return fx

func test_plain_text_has_no_effect_layers() -> void:
	var fx := _fx()
	fx.show_text("YOU", "", PC)
	assert_true(fx.plain_label().visible)
	assert_eq(fx.plain_label().get_theme_color("font_color"), PLAIN)
	assert_false(fx.display().visible)
	assert_eq(fx.get_combined_minimum_size(), fx.plain_label().get_combined_minimum_size())

func test_plain_size_follows_the_font_once_the_theme_settles() -> void:
	var fx := _fx()
	fx.show_text("PARITY7", "", PC)
	await get_tree().process_frame
	assert_eq(fx.get_combined_minimum_size(), fx.plain_label().get_combined_minimum_size(),
		"a stale minimum from the default font would let the text spill into the next column")

func test_a_css_font_reaches_the_plain_text_the_glow_and_the_copies() -> void:
	var fx := _fx()
	fx.configure_css(FONT_SIZE, SPACING_EM, PLAIN)
	fx.show_text("PARITY7", "", PC)
	var run := CssTextRun.new("PARITY7", FONT_SIZE, SPACING_EM)
	assert_almost_eq(fx.get_combined_minimum_size().x, run.width(), EPS, "the plain .nm text at Chrome's width")
	fx.show_text(TEXT, "double", PC)
	var glitched := CssTextRun.new(TEXT, FONT_SIZE, SPACING_EM)
	assert_almost_eq(fx.glow().label().run().width(), glitched.width(), EPS)
	for clip in fx.glitch_copies():
		assert_almost_eq((clip.get_child(0) as CssLabel).run().width(), glitched.width(), EPS, "the chroma copies too")

func test_double_is_player_coloured_glitched_and_electrified() -> void:
	var fx := _fx()
	fx.show_text(TEXT, "double", PC)
	assert_false(fx.plain_label().visible)
	assert_true(fx.display().visible)
	assert_eq(fx.glow().label().get_theme_color("font_color"), PC)
	assert_eq(fx.glitch_copies().size(), 2)
	assert_eq(fx.arcs().size(), 3)
	assert_eq(fx.ticks().size(), 0)
	assert_eq(fx.glow().layer_count(), 1, "text-shadow 0 0 12px --pc")
	var filter := fx.display().material as ShaderMaterial
	assert_almost_eq(filter.get_shader_parameter("scale_px"), 3.0, EPS, "ks-el1 displacement scale")
	var origin: Vector2 = filter.get_shader_parameter("box_origin_px")
	var region := Rect2(filter.get_shader_parameter("region_origin_px"), filter.get_shader_parameter("region_size_px"))
	var glow_box := Rect2(origin, fx.get_combined_minimum_size()).grow(fx.glow().padding())
	assert_true(region.encloses(glow_box), "the filter never cuts the 12px glow into a box")

func test_catalyst_throbs_with_sparks_and_ticks_but_no_filter() -> void:
	var fx := _fx()
	fx.show_text("YOU: CATALYST", "catalyst", PC)
	assert_eq(fx.glow().label().get_theme_color("font_color"), Color.WHITE)
	assert_eq(fx.glitch_copies().size(), 0)
	assert_eq(fx.arcs().size(), 5)
	assert_eq(fx.ticks().size(), 3)
	assert_almost_eq((fx.display().material as ShaderMaterial).get_shader_parameter("scale_px"), 0.0, EPS)
	fx.advance(StreakFx.THROB_PERIOD_S * 0.5)
	assert_eq(fx.glow().layer_count(), 3, "peak of ks-throb: 18px pc, 6px #fff, 30px pc 60%")

func test_double_flickers_the_whole_element() -> void:
	var fx := _fx()
	fx.show_text(TEXT, "double", PC)
	fx.advance(StreakFx.FLICK_PERIOD_S * 0.5)
	assert_almost_eq(fx.display().modulate.a, 0.85, EPS)

func test_singularity_scrambles_and_snaps_back() -> void:
	var fx := _fx()
	fx.set_rng(func() -> float: return 0.0)
	fx.show_text("YOU: SINGULARITY", "singularity", PC)
	fx.advance(StreakFx.SCRAMBLE_MS / 1000.0)
	assert_eq(fx.shown_text(), "###: ###########", "every letter replaced at chance 0")
	assert_eq(fx.glitch_copies()[0].get_child(0).text, fx.shown_text(), "copies show the corrupted text too")
	fx.advance(StreakFx.SCRAMBLE_FLASH_MS / 1000.0)
	assert_eq(fx.shown_text(), "YOU: SINGULARITY")

func test_a_new_text_restarts_the_animation_clock() -> void:
	var fx := _fx()
	fx.show_text(TEXT, "double", PC)
	fx.advance(StreakFx.FLICK_PERIOD_S * 0.5)
	fx.show_text(TEXT, "triple", PC)
	assert_almost_eq(fx.elapsed(), 0.0, EPS)
