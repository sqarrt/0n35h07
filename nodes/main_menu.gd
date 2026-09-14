class_name MainMenu extends Control
## Main menu — port of the web App menu screen (screens/MainMenu in the .menu-panel, components/VersionChip): the
## centred 680 px panel (the page background through 72%, hairline sides), the glowing 0N35H07 logo over the accent
## rule, PLAY (primary), APPEARANCE / SETTINGS / ABOUT (secondary) and, on the desktop build, QUIT (ghost), all half the
## panel wide, and the version chip in the corner (desktop: it opens the log folder). The 3D backdrop, the screens
## behind the buttons and RADIO come with their own slices; the map is picked in the lobby (web). Texts follow the active
## locale (I18n); a language picked in SETTINGS rebuilds the column and that screen.

signal screen_requested(screen: String)   # web setScreen: appearance / settings / about

const PANEL_MAX_WIDTH := 680.0             # .menu-panel width: min(680px, 92vw)
const PANEL_VIEWPORT_SHARE := 0.92
const PANEL_BACKGROUND := Color(10.0 / 255.0, 12.0 / 255.0, 17.0 / 255.0, 0.72)
const PANEL_PADDING := Vector2(40.0, 32.0) # padding: 32px 40px
const PANEL_BLUR_PX := 2.0                 # backdrop-filter: blur(2px) — σ in pixels
const BACKDROP_BLUR_SHADER := preload("res://assets/shaders/backdrop_blur.gdshader")
const PANEL_BORDER_PX := 1                 # border-left / -right: 1px var(--surface-line)
const LOGO_TEXT := "0N35H07"
const LOGO_FONT_SIZE := 64                 # 4rem, bold
const LOGO_SPACING_EM := 0.3               # also its margin-left
const LOGO_MARGIN_BOTTOM := 16.0           # 1rem
const LOGO_GLOW_BLUR := 30.0               # text-shadow: 0 0 30px rgba(68,170,255,0.5)
const LOGO_GLOW := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.5)
const RULE_SIZE := Vector2(120.0, 1.0)     # .accent-rule
const RULE_MARGIN_BOTTOM := 32.0           # 2rem
const BUTTON_SHARE := 0.5                  # MENU_BUTTON_WIDTH 50%
const PLAY_KEY := "menuPlay"               # web dictionary keys
const APPEARANCE_KEY := "menuAppearance"
const SETTINGS_KEY := "menuSettings"
const ABOUT_KEY := "settingsSecAbout"
const QUIT_KEY := "menuExit"
const HINT_KEY := "menuFullscreenHint"     # browser only
const SMALL_FONT_SIZE := 11                # .menu-hint / .version-chip
const SMALL_SPACING_EM := 0.16
const HINT_MARGIN_TOP := 25.6              # 1.6rem
const VERSION_RIGHT := 16.0
const VERSION_BOTTOM := 14.0
const VERSION_HOVER_BRIGHTNESS := 1.7      # .version-chip--btn:hover filter: brightness(1.7)
const CHIP_STATES := ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]
const CHIP_BRIGHT_COLORS := ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]
const SCREEN_APPEARANCE := "appearance"
const SCREEN_SETTINGS := "settings"
const SCREEN_ABOUT := "about"
const SCREEN_TRAILER := "trailer"          # web About onWatchTrailer → setScreen('trailer')
const APPEARANCE_PANEL_MARGIN := 24.0      # web APPEARANCE_PANEL_MARGIN_PX: the panel's gap to the right edge
const PANEL_SLIDE_TAU := MenuCameraRig.DAMP_TAU   # web useDampedTranslateX (MENU_ANIM_TAU)
const PANEL_SLIDE_SNAP := 0.5              # the travel ends within half a pixel
const ARENA := "res://scenes/arena_test.tscn"
const LOGS_DIR := "user://logs"
const HALF := 0.5

var _panel: Panel
var _panel_blur: ColorRect
var _column: CssColumn
var _lobby: LobbyScreen
var profile_saving := true                    # parity captures edit an in-memory profile without saving it
var _screen: Control                          # the open SETTINGS / ABOUT / APPEARANCE screen
var _panel_base_x := 0.0
var _panel_slide := 0.0
var _panel_slide_target := 0.0
var _settings_section := SettingsScreen.SECTION_PLAYER   # web App keeps the settings tab across visits
var _backdrop: MenuBackdrop
var _buttons: Array[UiButton] = []
var _quit: UiButton
var _hint: Label
var _browser_layout := false
var _version: Button

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var background := ColorRect.new()
	background.name = "Background"
	background.color = UiTokens.BG                   # web App root: var(--bg)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_backdrop = MenuBackdrop.new()                   # web App: the persistent 3D backdrop under the menu panel
	add_child(_backdrop)
	_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel_blur = _backdrop_blur()
	add_child(_panel_blur)
	_panel = Panel.new()
	_panel.name = "Panel"
	_panel.add_theme_stylebox_override("panel", _panel_box())
	add_child(_panel)
	_build_column()
	_version = _version_chip()
	add_child(_version)
	resized.connect(_layout)
	_version.minimum_size_changed.connect(_layout)
	_layout()
	if not Game.warning_seen:   # web App: the photosensitivity warning over the menu, once per launch
		var warning := WarningSplash.new()
		warning.dismissed.connect(func() -> void: Game.warning_seen = true)
		add_child(warning)
	Audio.play_menu_music()   # web App: menu music on every non-match screen

## PLAY (web handlePlay): a fresh local room on every visit, shown in the same panel instead of the menu.
func open_lobby() -> void:
	close_screen()
	close_lobby()
	var room := RoomModel.new(Game.profile, Game.random.randf)
	_lobby = LobbyScreen.new()
	_lobby.name = "Lobby"
	_lobby.setup(room, Game.random.randf)
	_panel.add_child(_lobby)
	_lobby.back_requested.connect(close_lobby)
	_lobby.match_requested.connect(_start_match)
	_column.visible = false
	_show_room(room)
	room.changed.connect(_show_room.bind(room))
	_layout()

## BACK / LEAVE: the room closes, the menu returns.
func close_lobby() -> void:
	if _lobby != null:
		_lobby.queue_free()
		_lobby = null
	_column.visible = true
	_backdrop.set_screen(MenuCameraRig.SCREEN_MENU)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))

## SETTINGS (web setScreen('settings')): the settings screen in the panel, on the tab left open last time; every change
## is saved and the volumes applied at once.
func open_settings() -> void:
	_show_screen(_settings_screen(), MenuCameraRig.SCREEN_SETTINGS)

func _settings_screen() -> SettingsScreen:
	var settings := SettingsScreen.new()
	settings.name = "Settings"
	settings.setup(Game.profile, _settings_section)
	settings.back_requested.connect(close_screen)
	settings.profile_changed.connect(_save_profile)
	settings.section_changed.connect(func(section: String) -> void: _settings_section = section)
	settings.locale_changed.connect(_on_locale_changed)
	return settings

## A language tile (web setLocale: the tree re-renders in place): the menu column and the open settings are built again
## in the new language, on the same tab; the backdrop and its camera stay as they are.
func _on_locale_changed(locale: String) -> void:
	I18n.use_locale(locale)
	_build_column()
	_panel.remove_child(_screen)
	_screen.queue_free()
	_screen = _settings_screen()
	_panel.add_child(_screen)
	_layout()
	get_viewport().update_mouse_cursor_state()   # the new tile under the pointer takes the hover look

## ABOUT (web setScreen('about')): the developer and the trailer; WATCH asks for the trailer screen.
func open_about() -> void:
	var about := AboutScreen.new()
	about.name = "About"
	about.back_requested.connect(close_screen)
	about.trailer_requested.connect(screen_requested.emit.bind(SCREEN_TRAILER))
	_show_screen(about, MenuCameraRig.SCREEN_SETTINGS)

## APPEARANCE (web setScreen('appearance')): the cosmetics page; the panel slides right, the backdrop shows the live
## preview from the angle of the last clicked block, the edge glow stays silent.
func open_appearance() -> void:
	var appearance := AppearanceScreen.new()
	appearance.name = "AppearanceScreen"
	appearance.setup(Game.profile)
	appearance.back_requested.connect(close_screen)
	appearance.profile_changed.connect(_save_profile)
	appearance.preview_changed.connect(_show_preview)
	appearance.style_previewed.connect(_backdrop.preview_style)
	_show_screen(appearance, MenuCameraRig.SCREEN_APPEARANCE)

## BACK from SETTINGS / ABOUT / APPEARANCE: the menu returns.
func close_screen() -> void:
	if _screen == null:
		return
	_panel.remove_child(_screen)
	_screen.queue_free()
	_screen = null
	_column.visible = _lobby == null
	_backdrop.glow_muted = false
	_backdrop.set_screen(MenuCameraRig.SCREEN_MENU)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))
	_layout()

func screen() -> Control:
	return _screen

## The panel's slide right of its centred place (web translateX), damped toward its target.
func panel_slide() -> float:
	return _panel_slide

## web App: settings and about share the settings camera pose; appearance takes its own and mutes the glow.
func _show_screen(opened: Control, backdrop_screen: String) -> void:
	close_screen()
	close_lobby()
	_screen = opened
	_backdrop.glow_muted = opened is AppearanceScreen
	_backdrop.set_screen(backdrop_screen)
	_panel.add_child(opened)
	_column.visible = false
	_layout()

## web App menuPlayer on the appearance screen: your ball with the preview's look, the camera on the clicked block.
func _show_preview(spec: Dictionary, part: String) -> void:
	_backdrop.set_screen(MenuCameraRig.SCREEN_APPEARANCE, GameModes.DUEL, false, part)
	_backdrop.set_balls([{"key": MenuStage.PLAYER_KEY, "spec": spec, "spot": MenuStage.STAGE_SPOTS[0]}])

func _save_profile(profile: Dictionary) -> void:
	if profile_saving:
		ProfileStore.save_profile(profile, Game.random.randf)
	Audio.apply_volumes()

func _process(delta: float) -> void:
	if _panel_slide == _panel_slide_target:
		return
	_panel_slide += (_panel_slide_target - _panel_slide) * (1.0 - exp(-minf(delta, MenuCameraRig.MAX_DT) / PANEL_SLIDE_TAU))
	if absf(_panel_slide_target - _panel_slide) < PANEL_SLIDE_SNAP:
		_panel_slide = _panel_slide_target
	_place_panel()

func _place_panel() -> void:
	_panel.position = Vector2(_panel_base_x + _panel_slide, 0.0)
	_panel_blur.position = _panel.position

func backdrop() -> MenuBackdrop:
	return _backdrop

## web App: the lobby backdrop shows the room's seats and frames the preset (Duel pair / Battle-War square).
func _show_room(room: RoomModel) -> void:
	_backdrop.set_screen(MenuCameraRig.SCREEN_LOBBY, room.mode)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_LOBBY, MenuStage.profile_spec(Game.profile), room.occupied(),
		RoomModel.HOST_SLOT))

func lobby() -> LobbyScreen:
	return _lobby

## The browser build's layout (parity captures): the F11 hint instead of QUIT.
func set_browser_layout(browser: bool) -> void:
	_browser_layout = browser
	_hint.visible = browser
	_quit.visible = not browser

func _layout() -> void:
	var width := minf(PANEL_MAX_WIDTH, size.x * PANEL_VIEWPORT_SHARE)
	_panel_base_x = CssPixel.snap((size.x - width) * HALF)
	# web App: on appearance the panel sits APPEARANCE_PANEL_MARGIN from the right edge (Math.round of the offset)
	_panel_slide_target = maxf(0.0, roundf((size.x - width) * HALF - APPEARANCE_PANEL_MARGIN)) \
		if _screen is AppearanceScreen else 0.0
	_panel.size = Vector2(width, size.y)
	_panel_blur.size = _panel.size
	_place_panel()
	(_panel_blur.material as ShaderMaterial).set_shader_parameter("box_px", _panel.size)
	var inset := PANEL_PADDING + Vector2(PANEL_BORDER_PX, 0.0)
	_column.position = inset
	_column.size = _panel.size - inset * 2.0
	if _screen != null:
		_screen.position = inset
		_screen.size = _column.size
	if _lobby != null:
		_lobby.position = inset
		_lobby.size = _column.size + Vector2(LobbyScreen.BLEED, 0.0)
	for button in _buttons:
		button.custom_minimum_size.x = _column.size.x * BUTTON_SHARE
	var chip := _version.get_combined_minimum_size()
	_version.size = chip
	_version.position = size - chip - Vector2(VERSION_RIGHT, VERSION_BOTTOM)

## The .menu-panel backdrop-filter: the 3D backdrop behind the panel blurred before its 72% fill is drawn over it.
func _backdrop_blur() -> ColorRect:
	var blur := ColorRect.new()
	blur.name = "PanelBlur"
	blur.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var composite := ShaderMaterial.new()
	composite.shader = BACKDROP_BLUR_SHADER
	composite.set_shader_parameter("sigma", PANEL_BLUR_PX)
	blur.material = composite
	return blur

func _panel_box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = PANEL_BACKGROUND
	box.border_color = UiTokens.SURFACE_LINE
	box.border_width_left = PANEL_BORDER_PX
	box.border_width_right = PANEL_BORDER_PX
	box.anti_aliasing = false
	return box

## The logo, the accent rule, the buttons and the hint in the active locale; built again when the language changes.
func _build_column() -> void:
	if _column != null:
		_panel.remove_child(_column)
		_column.queue_free()
	_buttons.clear()
	_column = CssColumn.new()
	_column.name = "Column"
	_column.visible = _screen == null and _lobby == null
	_panel.add_child(_column)
	_panel.move_child(_column, 0)
	_add_logo()
	var rule := ColorRect.new()
	rule.name = "Rule"
	rule.color = UiTokens.LINE
	rule.custom_minimum_size = RULE_SIZE
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_column.add(rule, 0.0, RULE_MARGIN_BOTTOM)
	_add_button("Play", I18n.t(PLAY_KEY), UiButton.PRIMARY).pressed.connect(_on_play)
	_add_button("Appearance", I18n.t(APPEARANCE_KEY), UiButton.SECONDARY).pressed.connect(open_appearance)
	_add_button("Settings", I18n.t(SETTINGS_KEY), UiButton.SECONDARY).pressed.connect(open_settings)
	_add_button("About", I18n.t(ABOUT_KEY), UiButton.SECONDARY).pressed.connect(open_about)
	_quit = _add_button("Quit", I18n.t(QUIT_KEY), UiButton.GHOST)   # web: desktop only — this build always is one
	_quit.pressed.connect(_on_quit)
	_hint = _small_label("Hint", I18n.t(HINT_KEY))
	_column.add(_hint, HINT_MARGIN_TOP)
	set_browser_layout(_browser_layout)

## The h1: bold, spaced 0.3em (margin-left of one spacing), glowing; Chrome's trailing spacing kept in its box.
func _add_logo() -> void:
	var logo := GlowText.new()
	logo.name = "Logo"
	_column.add(logo, 0.0, LOGO_MARGIN_BOTTOM, LOGO_SPACING_EM * LOGO_FONT_SIZE)
	var font := UiFont.with_css_line(UiFont.bold_spaced(LOGO_SPACING_EM, LOGO_FONT_SIZE), LOGO_FONT_SIZE)
	var trailing := UiFont.trailing_spacing_style(font)
	logo.label().add_theme_stylebox_override("normal", trailing)
	logo.mask_label().add_theme_stylebox_override("normal", trailing)
	logo.configure(font, LOGO_FONT_SIZE, UiTokens.ACCENT)
	logo.set_text(LOGO_TEXT)
	logo.set_shadows([CssShadow.make(LOGO_GLOW_BLUR, LOGO_GLOW)])

func _add_button(node_name: String, label: String, variant: String) -> UiButton:
	var button := UiButton.new(label, variant)
	button.name = node_name
	_column.add(button, UiButton.MARGIN_Y, UiButton.MARGIN_Y)
	_buttons.append(button)
	return button

func _small_font() -> FontVariation:
	return UiFont.with_css_line(UiFont.spaced(SMALL_SPACING_EM, SMALL_FONT_SIZE), SMALL_FONT_SIZE)

func _small_label(node_name: String, text: String) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	var font := _small_font()
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	label.add_theme_color_override("font_color", UiTokens.MUTED)
	label.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(font))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

## The desktop version chip: the plain muted label that opens the log folder, brighter under the mouse.
func _version_chip() -> Button:
	var chip := Button.new()
	chip.name = "Version"
	chip.text = "v%s" % Game.GAME_VERSION
	chip.focus_mode = Control.FOCUS_NONE
	var font := _small_font()
	chip.add_theme_font_override("font", font)
	chip.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	var box := UiFont.trailing_spacing_style(font)
	for state in CHIP_STATES:
		chip.add_theme_stylebox_override(state, box)
	chip.add_theme_color_override("font_color", UiTokens.MUTED)
	chip.add_theme_color_override("font_focus_color", UiTokens.MUTED)
	var bright := Color(minf(UiTokens.MUTED.r * VERSION_HOVER_BRIGHTNESS, 1.0),
		minf(UiTokens.MUTED.g * VERSION_HOVER_BRIGHTNESS, 1.0), minf(UiTokens.MUTED.b * VERSION_HOVER_BRIGHTNESS, 1.0))
	for key in CHIP_BRIGHT_COLORS:
		chip.add_theme_color_override(key, bright)
	chip.pressed.connect(_on_version)
	return chip

func _on_play() -> void:
	open_lobby()

## The room started: the arena runs on its map, duration and seats (web RoomSession start → App setScreen('game')).
func _start_match(setup: Dictionary) -> void:
	Game.selected_map = MapCatalog.raw_path(setup["map_id"])
	Game.match_duration_ms = setup["duration_min"] * MatchConst.MS_PER_MIN
	Game.lobby_roster = setup["roster"]
	Game.lobby_mode = setup["mode"]
	get_tree().change_scene_to_file(ARENA)

func _on_quit() -> void:
	get_tree().quit()

func _on_version() -> void:
	OS.shell_show_in_file_manager(ProjectSettings.globalize_path(LOGS_DIR))
