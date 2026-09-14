extends GutTest
## Main menu parity with web screens/MainMenu inside the App menu panel: the items and their button variants, the
## 680 px panel and its padded column, half-panel-wide buttons, the logo box, the accent rule and the version chip in
## the corner; the browser layout (the F11 hint instead of QUIT) the parity captures use.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const BUTTON_STEP := 56.8          # 44 px buttons with 6.4 px margins that don't collapse

func _menu() -> MainMenu:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var menu := (load("res://scenes/main_menu.tscn") as PackedScene).instantiate() as MainMenu
	viewport.add_child(menu)
	await wait_process_frames(3)
	return menu

func _control(menu: MainMenu, node_name: String) -> Control:
	return menu.find_child(node_name, true, false) as Control

func test_the_web_items() -> void:
	var menu := await _menu()
	assert_eq((_control(menu, "Logo") as GlowText).label().text, "0N35H07")
	var expected := {"Play": UiButton.PRIMARY, "Appearance": UiButton.SECONDARY, "Settings": UiButton.SECONDARY,
		"About": UiButton.SECONDARY, "Quit": UiButton.GHOST}
	for node_name in expected:
		assert_eq((_control(menu, node_name) as UiButton).variant, expected[node_name], node_name)
	assert_eq((_control(menu, "Play") as UiButton).text, "PLAY")
	assert_false(_control(menu, "Hint").visible, "the F11 hint is the browser's (desktop builds are fullscreen)")
	assert_eq((_control(menu, "Version") as Button).text, "v%s" % Game.GAME_VERSION)

func test_panel_column_and_buttons_follow_the_web_boxes() -> void:
	var menu := await _menu()
	var panel := _control(menu, "Panel")
	assert_eq(panel.get_global_rect(), Rect2(300.0, 0.0, 680.0, 720.0), "min(680px, 92vw), centred, full height")
	var play := _control(menu, "Play")
	assert_eq(play.size, Vector2(299.0, 44.0), "50% of the 598 px padded column")
	assert_almost_eq(play.global_position.x, CssPixel.snap(490.5), EPS)
	var appearance := _control(menu, "Appearance")
	assert_true(absf(appearance.global_position.y - play.global_position.y - BUTTON_STEP) <= 1.0, "buttons 56.8 px apart")
	var rule := _control(menu, "Rule")
	assert_eq(rule.size, MainMenu.RULE_SIZE)
	assert_almost_eq(rule.global_position.x, 580.0, EPS)
	assert_almost_eq(_control(menu, "Logo").size.y, 72.0, EPS, "64 px line-height normal: 57 + 15")

func test_the_panel_blurs_the_backdrop_behind_it() -> void:
	var menu := await _menu()
	var blur := _control(menu, "PanelBlur")
	var panel := _control(menu, "Panel")
	assert_eq(blur.get_global_rect(), panel.get_global_rect(), "backdrop-filter reads the panel's border box")
	var composite := blur.material as ShaderMaterial
	assert_almost_eq(float(composite.get_shader_parameter("sigma")), MainMenu.PANEL_BLUR_PX, EPS, "blur(2px): σ 2 px")
	assert_eq(composite.get_shader_parameter("box_px"), panel.size)
	assert_lt(blur.get_index(), panel.get_index(), "blurred first, the 72% fill on top")

func test_version_chip_sits_in_the_corner() -> void:
	var menu := await _menu()
	var version := _control(menu, "Version")
	var rect := version.get_global_rect()
	assert_almost_eq(rect.end.x, SCREEN.x - MainMenu.VERSION_RIGHT, EPS, "right: 16px")
	assert_almost_eq(rect.end.y, SCREEN.y - MainMenu.VERSION_BOTTOM, EPS, "bottom: 14px")

func test_play_opens_the_lobby_in_the_panel_and_back_returns() -> void:
	var menu := await _menu()
	(_control(menu, "Play") as UiButton).pressed.emit()
	await wait_process_frames(2)
	var lobby := _control(menu, "Lobby") as LobbyScreen
	assert_not_null(lobby, "web App screen 'lobby'")
	assert_false(_control(menu, "Column").visible, "the lobby replaces the menu inside the same panel")
	assert_eq(lobby.get_global_rect().position, Vector2(341.0, 32.0))
	assert_almost_eq(lobby.size.x, 598.0 + LobbyScreen.BLEED, EPS, "the column plus the scrollbar bleed")
	lobby.back_requested.emit()
	await wait_process_frames(1)
	assert_true(_control(menu, "Column").visible)
	assert_null(menu.lobby())

func test_settings_and_about_open_in_the_panel() -> void:
	var menu := await _menu()
	(_control(menu, "Settings") as UiButton).pressed.emit()
	await wait_process_frames(1)
	assert_true(menu.screen() is SettingsScreen, "web App screen 'settings'")
	assert_false(_control(menu, "Column").visible)
	assert_eq(menu.screen().get_global_rect(), Rect2(341.0, 32.0, 598.0, 656.0), "the padded panel column")
	assert_eq(menu.backdrop().rig.state(), MenuCameraRig.DEFAULT, "the settings pose")
	(menu.screen() as SettingsScreen).back_requested.emit()
	await wait_process_frames(1)
	assert_null(menu.screen())
	assert_true(_control(menu, "Column").visible)
	menu.open_about()
	await wait_process_frames(1)
	assert_true(menu.screen() is AboutScreen)
	menu.open_lobby()
	await wait_process_frames(1)
	assert_null(menu.screen(), "PLAY replaces the open screen")
	menu.close_lobby()

func test_browser_layout_for_parity_captures() -> void:
	var menu := await _menu()
	menu.set_browser_layout(true)
	assert_true(_control(menu, "Hint").visible)
	assert_false(_control(menu, "Quit").visible, "the web tab has no exit")
