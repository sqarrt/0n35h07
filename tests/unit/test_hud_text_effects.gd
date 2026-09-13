extends GutTest
## HUD text effects parity with web CountdownOverlay, StreakBanner and RespawnOverlay: sizes, colours, real blurred
## glows, the cdPop / ks-annShow curves and the ghost-phase bars.

const SCREEN := Vector2i(1280, 720)
const EPS := 0.001
const HALF := 0.5
const EARLY := 0.1
const LATE := 0.9

func _on_screen(node: Control) -> Control:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	screen.add_child(node)
	return node

func test_countdown_number_uses_the_web_look() -> void:
	var countdown := _on_screen(HudCountdown.new()) as HudCountdown
	countdown.set_number("3")
	var number := countdown.find_child("Number", true, false) as GlowText
	assert_eq(number.label().text, "3")
	assert_eq(HudCountdown.FONT_SIZE, 144, "web 9rem")
	assert_eq(number.label().get_theme_font_size("font_size"), HudCountdown.FONT_SIZE)
	assert_eq(number.label().get_theme_color("font_color"), HudCountdown.COLOR)
	assert_eq(HudCountdown.COLOR, Color("#44aaff"), "web #4af")
	assert_eq(number.layer_count(), 1, "web text-shadow: 0 0 40px rgba(68,170,255,0.6)")
	var glow := number.layers()[0].material as ShaderMaterial
	assert_almost_eq(glow.get_shader_parameter("sigma"), 20.0, EPS, "a 40px blur is a real Gaussian, not an outline")
	assert_eq(glow.get_shader_parameter("tint"), HudCountdown.GLOW_COLOR)
	var dim := countdown.find_child("Dim", true, false) as ColorRect
	assert_almost_eq(dim.color.a, 0.35, EPS, "web rgba(10,10,15,0.35)")

func test_countdown_number_pops_and_restarts_per_number() -> void:
	var countdown := _on_screen(HudCountdown.new()) as HudCountdown
	var number := countdown.find_child("Number", true, false) as GlowText
	countdown.set_number("3")
	countdown.tick(HALF)
	var pop := HudModel.countdown_pop(HALF)
	assert_almost_eq(number.scale.x, pop["scale"], EPS)
	assert_almost_eq(number.modulate.a, pop["opacity"], EPS)
	countdown.tick(LATE - HALF)
	countdown.set_number("2")
	assert_almost_eq(number.scale.x, HudModel.POP_START_SCALE, EPS, "a new number restarts cdPop (web key={n})")
	countdown.set_number("2")
	countdown.tick(EARLY)
	assert_almost_eq(number.scale.x, HudModel.countdown_pop(EARLY)["scale"], EPS, "the same number keeps playing")

func test_streak_banner_names_the_player_and_flickers_out() -> void:
	var banner := _on_screen(HudStreakBanner.new()) as HudStreakBanner
	assert_eq(HudStreakBanner.TOP, 64, "web .streak-banner top")
	assert_eq(HudStreakBanner.FONT_SIZE, 24)
	assert_false(banner.visible)
	banner.announce("YOU", "catalyst", Color("#4af"))
	var text := banner.find_child("Text", true, false) as EffectText
	assert_true(banner.visible)
	assert_eq(text.shown_text(), "YOU: CATALYST")
	assert_eq(text.kind(), "catalyst")
	banner.tick(HudModel.BANNER_DURATION_S * HALF)
	assert_almost_eq(text.modulate.a, HudModel.banner_opacity(HudModel.BANNER_DURATION_S * HALF), EPS)
	assert_almost_eq(text.elapsed(), HudModel.BANNER_DURATION_S * HALF, EPS, "the effect runs on the banner clock")
	banner.tick(HudModel.BANNER_DURATION_S)
	assert_false(banner.visible, "gone after 2.05 s")

func test_ghost_indicator_bars_shrink_with_the_remaining_phase() -> void:
	var ghost := _on_screen(HudGhostIndicator.new()) as HudGhostIndicator
	ghost.show_progress(HALF)
	assert_true(ghost.visible)
	assert_almost_eq(ghost.bar_width(), SCREEN.x * HudModel.ghost_bar_width_share(HALF), EPS)
	var label := ghost.find_child("Label", true, false) as GlowText
	assert_eq(label.label().text, HudGhostIndicator.TEXT)
	assert_eq(HudGhostIndicator.TEXT, "RESPAWNING", "web dictionary respawning")
	assert_eq(label.label().get_theme_color("font_color"), HudGhostIndicator.COLOR)
	assert_eq(HudGhostIndicator.COLOR, Color("#99ccff"), "web #9cf")
	assert_eq(label.layer_count(), 1, "web text-shadow 0 0 8px")
	ghost.hide_indicator()
	assert_false(ghost.visible)

func test_ghost_bars_glow_softly_on_the_hud_frame() -> void:
	var ghost := _on_screen(HudGhostIndicator.new()) as HudGhostIndicator
	ghost.show_progress(HALF)
	var bars := ghost.bars()
	assert_eq(bars.size(), 2)
	var width := ghost.bar_width()
	var material := bars[0].material as ShaderMaterial
	var pad: float = material.get_shader_parameter("pad_px")
	assert_eq(material.get_shader_parameter("box_px"), Vector2(width, HudGhostIndicator.THICKNESS))
	assert_almost_eq(material.get_shader_parameter("sigma"), 5.0, EPS, "box-shadow 0 0 10px is a Gaussian glow")
	assert_almost_eq(bars[0].position.y + pad, HudGhostIndicator.INSET, EPS, "top bar 21px from the top")
	assert_almost_eq(bars[1].position.y + pad + HudGhostIndicator.THICKNESS, SCREEN.y - HudGhostIndicator.INSET, EPS)
	assert_almost_eq(bars[0].position.x + pad + width / 2.0, SCREEN.x / 2.0, EPS, "centred")
	ghost.show_progress(0.0)
	assert_false(bars[0].visible, "no bar once the phase is over")

func test_hud_uses_the_styled_text_effects() -> void:
	var hud := Hud.new()
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	screen.add_child(hud)
	for element in ["Countdown", "StreakBanner", "GhostIndicator"]:
		assert_not_null(hud.find_child(element, true, false), "%s is part of the HUD" % element)
