extends GutTest
## HUD text effects parity with web CountdownOverlay, StreakBanner and RespawnOverlay: sizes, colours, the
## cdPop / ks-annShow curves and the ghost-phase bars.

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
	var number := countdown.find_child("Number", true, false) as Label
	assert_eq(number.text, "3")
	assert_eq(HudCountdown.FONT_SIZE, 144, "web 9rem")
	assert_eq(number.get_theme_font_size("font_size"), HudCountdown.FONT_SIZE)
	assert_eq(number.get_theme_color("font_color"), HudCountdown.COLOR)
	assert_eq(HudCountdown.COLOR, Color("#44aaff"), "web #4af")
	var dim := countdown.find_child("Dim", true, false) as ColorRect
	assert_almost_eq(dim.color.a, 0.35, EPS, "web rgba(10,10,15,0.35)")

func test_countdown_number_pops_and_restarts_per_number() -> void:
	var countdown := _on_screen(HudCountdown.new()) as HudCountdown
	var number := countdown.find_child("Number", true, false) as Label
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
	banner.announce("YOU", "CATALYST")
	var text := banner.find_child("Text", true, false) as Label
	assert_true(banner.visible)
	assert_eq(text.text, "YOU: CATALYST")
	banner.tick(HudModel.BANNER_DURATION_S * HALF)
	assert_almost_eq(text.modulate.a, HudModel.banner_opacity(HudModel.BANNER_DURATION_S * HALF), EPS)
	banner.tick(HudModel.BANNER_DURATION_S)
	assert_false(banner.visible, "gone after 2.05 s")

func test_ghost_indicator_bars_shrink_with_the_remaining_phase() -> void:
	var ghost := _on_screen(HudGhostIndicator.new()) as HudGhostIndicator
	ghost.show_progress(HALF)
	assert_true(ghost.visible)
	assert_almost_eq(ghost.bar_width(), SCREEN.x * HudModel.ghost_bar_width_share(HALF), EPS)
	var label := ghost.find_child("Label", true, false) as Label
	assert_eq(label.text, HudGhostIndicator.TEXT)
	assert_eq(HudGhostIndicator.TEXT, "RESPAWNING", "web dictionary respawning")
	assert_eq(label.get_theme_color("font_color"), HudGhostIndicator.COLOR)
	assert_eq(HudGhostIndicator.COLOR, Color("#99ccff"), "web #9cf")
	ghost.hide_indicator()
	assert_false(ghost.visible)

func test_hud_uses_the_styled_text_effects() -> void:
	var hud := Hud.new()
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	screen.add_child(hud)
	for element in ["Countdown", "StreakBanner", "GhostIndicator"]:
		assert_not_null(hud.find_child(element, true, false), "%s is part of the HUD" % element)
