extends GutTest
## In-match settings against the Chrome boxes of web MatchSettings in the pause (parity-capture-match-settings.mjs,
## browser build: no radio slider): the column centred on 1280×720, SOUND first, GRAPHICS without the menu-only switches,
## changes written to the live profile, BACK.

const SCREEN := Vector2i(1280, 720)
const PX := 1.0
const PROFILE := {"volumeMaster": 1.0, "volumeMusic": 0.3, "volumeMenuMusic": 0.3, "volumeSfx": 1.0, "volumeRadio": 0.8,
	"postProcessing": true, "menuGlow": true, "audioViz": true, "showFps": false, "showSpeed": false}

func _panel(radio := false) -> MatchSettings:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var panel := MatchSettings.new()
	panel.setup(PROFILE.duplicate())
	panel.set_radio_visible(radio)
	viewport.add_child(panel)
	return panel

func _rect(panel: MatchSettings, node_name: String) -> Rect2:
	return (panel.find_child(node_name, true, false) as Control).get_global_rect()

func _near(actual: Vector2, expected: Vector2, what: String) -> void:
	assert_true(actual.distance_to(expected) <= PX, "%s: %s vs web %s" % [what, actual, expected])

func test_sound_column_boxes() -> void:
	var panel := _panel()
	assert_eq(panel.tab, MatchSettings.TAB_SOUND, "web useState('sound')")
	_near(_rect(panel, "Title").position, Vector2(569.0, 146.0), "h2 at 568.95, 146.03")
	assert_almost_eq(_rect(panel, "Tab_sound").position.y, 195.0, PX, "tabs at 195.42")
	_near(_rect(panel, "VolumeHeader").position, Vector2(416.0, 246.0), "sub-header at 416, 246.02")
	assert_eq(_rect(panel, "VolumeHeader").size.x, 448.0, "min(28rem, 80vw)")
	_near(_rect(panel, "Volume_volumeMaster").position, Vector2(416.0, 288.0), "slider block at 287.61")
	_near(_rect(panel, "Back").position, Vector2(530.0, 524.0), "BACK at 530, 523.56")
	assert_eq(_rect(panel, "Back").size, Vector2(UiButton.MIN_WIDTH, UiButton.BUTTON_HEIGHT))

func test_the_desktop_panel_adds_the_radio_slider() -> void:
	var panel := _panel(true)
	assert_true(panel.find_child("Volume_volumeRadio", true, false).visible)
	assert_lt(_rect(panel, "Title").position.y, 146.0, "a taller column sits higher")

func test_graphics_column_without_the_menu_only_switches() -> void:
	var panel := _panel()
	panel.select_tab(MatchSettings.TAB_GRAPHICS)
	assert_null(panel.find_child("Toggle_menuGlow", true, false), "web inMatch")
	assert_null(panel.find_child("Toggle_audioViz", true, false))
	_near(_rect(panel, "Title").position, Vector2(569.0, 175.0), "h2 at 174.62")
	_near(_rect(panel, "Toggle_postProcessing").position, Vector2(416.0, 316.0), "toggle at 316.2")
	_near(_rect(panel, "ToggleLabel_postProcessing").position, Vector2(464.0, 319.0), "caption at 464.39, 318.7")
	_near(_rect(panel, "Toggle_showSpeed").position, Vector2(416.0, 445.0), "toggle at 444.98")
	_near(_rect(panel, "Back").position, Vector2(530.0, 495.0), "BACK at 494.97")

func test_changes_write_the_live_profile_and_back_leaves() -> void:
	var panel := _panel()
	watch_signals(panel)
	(panel.find_child("Volume_volumeSfx", true, false) as UiSlider).value_changed.emit(0.25)
	assert_eq(panel.profile["volumeSfx"], 0.25)
	assert_signal_emitted(panel, "profile_changed")
	(panel.find_child("Back", true, false) as UiButton).pressed.emit()
	assert_signal_emitted(panel, "back_requested")
