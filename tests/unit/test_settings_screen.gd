extends GutTest
## Settings screen against the Chrome boxes of web screens/Settings in the desktop build (parity-capture-settings.mjs):
## the panel column at (341, 32) 598×656, tabs PLAYER / SOUND / GRAPHICS, the fields of each page on whole pixels, BACK
## at the bottom; tab switching and profile writes.

const SCREEN := Vector2i(1280, 720)
const COLUMN := Rect2(341.0, 32.0, 598.0, 656.0)
const PX := 1.0

func _settings(section := SettingsScreen.SECTION_PLAYER) -> SettingsScreen:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var settings := SettingsScreen.new()
	settings.setup({"name": "PARITY7", "defaultView": "fp", "locale": "en", "volumeMaster": 1.0, "volumeMusic": 0.3,
		"volumeMenuMusic": 0.3, "volumeSfx": 1.0, "volumeRadio": 0.8, "postProcessing": true, "menuGlow": true,
		"audioViz": true, "showFps": false, "showSpeed": false}, section)
	viewport.add_child(settings)
	settings.position = COLUMN.position
	settings.size = COLUMN.size
	return settings

func _rect(settings: SettingsScreen, node_name: String) -> Rect2:
	return (settings.find_child(node_name, true, false) as Control).get_global_rect()

func _near(actual: Vector2, expected: Vector2, what: String) -> void:
	assert_true(actual.distance_to(expected) <= PX, "%s: %s vs web %s" % [what, actual, expected])

func test_desktop_tabs() -> void:
	assert_eq(SettingsScreen.visible_sections(true), ["player", "sound", "graphics"], "no NETWORK on the desktop build")
	assert_eq(SettingsScreen.visible_sections(false).size(), 4)

func test_player_page_boxes() -> void:
	var settings := _settings()
	_near(_rect(settings, "Title").position, Vector2(341.0, 75.0), "h2 at 75.19")
	_near(_rect(settings, "Tab_player").position, Vector2(341.0, 118.0), "tab at 118.19")
	_near(_rect(settings, "Tab_sound").position, Vector2(416.0, 118.0), "tab at 415.52")
	_near(_rect(settings, "NameLabel").position, Vector2(341.0, 172.0), "label at 171.98")
	var name_field := _rect(settings, "Name")
	_near(name_field.position, Vector2(341.0, 195.0), "input at 194.58")
	assert_eq(name_field.size, Vector2(256.0, 41.0))
	var first := _rect(settings, "View_fp")
	# the segment widths carry the known whole-pixel advance / spacing residual (Chrome 105.84 px), the 0.6rem gap stays
	_near(_rect(settings, "View_tp").position, Vector2(CssPixel.snap(first.end.x + SettingsScreen.ROW_GAP), 284.0),
		"seg at 283.77, 0.6rem after FIRST PERSON")
	var english := _rect(settings, "Lang_en")
	_near(english.position, Vector2(341.0, 357.0), "tile at 356.95")
	assert_eq(english.size, Vector2(114.0, 32.0), "1fr of 598 − 4 × 6.4")
	_near(_rect(settings, "Lang_fr").position, Vector2(462.0, 357.0), "tile at 461.88")
	_near(_rect(settings, "Back").position, Vector2(341.0, 638.0), "BACK at 637.61")
	assert_eq(_rect(settings, "Back").size, Vector2(598.0, UiButton.BUTTON_HEIGHT))

func test_sound_page_boxes() -> void:
	var settings := _settings(SettingsScreen.SECTION_SOUND)
	assert_true(settings.page(SettingsScreen.SECTION_SOUND).visible)
	assert_false(settings.page(SettingsScreen.SECTION_PLAYER).visible)
	_near(_rect(settings, "VolumeHeader").position, Vector2(341.0, 172.0), "sub-header at 171.98")
	_near(_rect(settings, "Volume_volumeMaster").position, Vector2(341.0, 214.0), "slider block at 213.58")
	_near(_rect(settings, "Volume_volumeRadio").position, Vector2(341.0, 443.0), "radio block at 443.14")

func test_graphics_page_boxes() -> void:
	var settings := _settings(SettingsScreen.SECTION_GRAPHICS)
	_near(_rect(settings, "Toggle_postProcessing").position, Vector2(341.0, 214.0), "toggle at 213.58")
	_near(_rect(settings, "ToggleLabel_postProcessing").position, Vector2(389.0, 216.0), "caption at 389.39, 216.08")
	_near(_rect(settings, "OverlayHeader").position, Vector2(341.0, 344.0), "sub-header at 344.36")
	_near(_rect(settings, "Toggle_showSpeed").position, Vector2(341.0, 430.0), "toggle at 429.55")

func test_tabs_switch_pages() -> void:
	var settings := _settings()
	watch_signals(settings)
	(settings.find_child("Tab_graphics", true, false) as SegButton).pressed.emit()
	assert_true(settings.page(SettingsScreen.SECTION_GRAPHICS).visible)
	assert_false(settings.page(SettingsScreen.SECTION_PLAYER).visible)
	assert_signal_emitted_with_parameters(settings, "section_changed", ["graphics"])

func test_changes_write_the_profile() -> void:
	var settings := _settings()
	watch_signals(settings)
	(settings.find_child("View_tp", true, false) as SegButton).pressed.emit()
	assert_eq(settings.profile["defaultView"], "tp")
	(settings.find_child("Lang_ru", true, false) as UiButton).pressed.emit()
	assert_eq(settings.profile["locale"], "ru")
	assert_eq((settings.find_child("Lang_ru", true, false) as UiButton).variant, UiButton.PRIMARY)
	assert_eq((settings.find_child("Lang_en", true, false) as UiButton).variant, UiButton.SECONDARY)
	(settings.find_child("Name", true, false) as UiTextField).text_changed.emit("AN EXTREMELY LONG NAME")
	assert_eq(settings.profile["name"], "AN EXTREMELY LON", "NAME_MAX")
	(settings.find_child("Toggle_showFps", true, false) as UiToggle).pressed.emit()
	assert_true(settings.profile["showFps"])
	(settings.find_child("Volume_volumeSfx", true, false) as UiSlider).value_changed.emit(0.25)
	assert_eq(settings.profile["volumeSfx"], 0.25)
	assert_signal_emit_count(settings, "profile_changed", 5)

func test_only_a_new_language_asks_for_a_rebuild() -> void:
	var settings := _settings()
	watch_signals(settings)
	(settings.find_child("Lang_en", true, false) as UiButton).pressed.emit()
	assert_signal_not_emitted(settings, "locale_changed", "web setLocale to the same locale renders nothing new")
	(settings.find_child("Lang_ru", true, false) as UiButton).pressed.emit()
	assert_signal_emitted_with_parameters(settings, "locale_changed", ["ru"])

func test_texts_come_in_the_active_locale() -> void:
	I18n.use_locale("ru")
	var settings := _settings()
	I18n.use_locale(Locales.FALLBACK)
	assert_eq((settings.find_child("Title", true, false) as Label).text, "НАСТРОЙКИ")
	assert_eq((settings.find_child("Tab_player", true, false) as SegButton).text, "ИГРОК")
	assert_eq((settings.find_child("Back", true, false) as UiButton).text, "НАЗАД")
