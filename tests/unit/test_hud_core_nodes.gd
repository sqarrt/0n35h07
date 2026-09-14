extends GutTest
## Core HUD composition parity with web GameOverlay (1v1, live): top bar, crosshair ring, shield brackets, dash bars;
## no bottom progress bars (the web has none) and no always-on speed text (web showSpeed is off by default).

const WEB_ELEMENTS := ["TopBar", "Crosshair", "ShieldBrackets", "DashBars"]

func _hud() -> Hud:
	var hud := Hud.new()
	add_child_autofree(hud)
	return hud

func test_hud_has_the_web_elements() -> void:
	var hud := _hud()
	for element in WEB_ELEMENTS:
		assert_not_null(hud.find_child(element, true, false), "%s is part of the live HUD" % element)

func test_bottom_bars_and_speed_text_are_gone() -> void:
	var hud := _hud()
	assert_eq(hud.find_children("*", "ProgressBar", true, false).size(), 0, "no BEAM / SHIELD / DASH bars")
	assert_null(hud.find_child("Speed", true, false), "the speed readout is an opt-in overlay in the web")

const CENTER_TOLERANCE := 1.0
const TIMER_TEXT := "02:55"
const SCREEN := Vector2i(1280, 720)   # the parity capture resolution (headless root is only 64x64)

## A HUD inside a real-size viewport, laid out for one frame.
func _hud_on_screen() -> Hud:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var hud := Hud.new()
	screen.add_child(hud)
	await get_tree().process_frame
	return hud

func test_full_screen_layers_cover_the_viewport() -> void:
	var hud := await _hud_on_screen()
	for element in ["ShieldBrackets", "DashBars"]:
		var layer := hud.find_child(element, true, false) as Control
		assert_eq(layer.size, Vector2(SCREEN), "%s spans the screen so right/bottom elements land on it" % element)

func test_top_bar_row_is_centred_at_the_web_offset() -> void:
	var hud := await _hud_on_screen()
	var viewport := Vector2(SCREEN)
	var timer := hud.find_child("Timer", true, false) as Control
	var row := timer.get_parent().get_parent() as Control   # Timer -> frame -> row
	assert_almost_eq(row.global_position.x + row.size.x / 2.0, viewport.x / 2.0, CENTER_TOLERANCE, "centred like web translateX(-50%)")
	assert_almost_eq(row.global_position.y, float(HudTopBar.TOP), CENTER_TOLERANCE, "web .match-hud top: 30px")

func test_the_timer_frame_is_the_css_border_box() -> void:
	var hud := await _hud_on_screen()
	(hud.find_child("TopBar", true, false) as HudTopBar).set_state(0, 0, TIMER_TEXT)
	await get_tree().process_frame
	var timer := hud.find_child("Timer", true, false) as CssLabel
	var frame := timer.get_parent() as Control
	assert_almost_eq(frame.get_combined_minimum_size().x,
		timer.run().width() + 2.0 * (HudTopBar.TIMER_PADDING + HudTopBar.TIMER_BORDER), CENTER_TOLERANCE * 0.01,
		"padding 0 14px inside a 1 px border each side: 111 px around 02:55 in Chrome")

func test_timer_uses_the_web_size_and_colour() -> void:
	var timer := _hud().find_child("Timer", true, false) as Label
	assert_not_null(timer)
	assert_eq(timer.get_theme_font_size("font_size"), HudTopBar.TIMER_FONT_SIZE)
	assert_eq(timer.get_theme_color("font_color"), HudTopBar.TIMER_COLOR)
	assert_eq(HudTopBar.TIMER_FONT_SIZE, 26, "web .match-hud .timer font-size")
	assert_eq(HudTopBar.TIMER_COLOR, Color("#dfe9f5"), "web .match-hud .timer color")
