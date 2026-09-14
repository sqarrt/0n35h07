class_name MainMenu extends Control
## Main menu — port of the web App menu screen (screens/MainMenu in the .menu-panel, components/VersionChip): the
## centred 680 px panel (the page background through 72%, hairline sides), the glowing 0N35H07 logo over the accent
## rule, PLAY (primary), APPEARANCE / SETTINGS / ABOUT (secondary) and, on the desktop build, QUIT (ghost), all half the
## panel wide, and the version chip in the corner (desktop: it opens the log folder). The 3D backdrop, the screens
## behind the buttons, RADIO and the translations come with their own slices; the map is picked in the lobby (web).

signal screen_requested(screen: String)   # web setScreen: appearance / settings / about

const PANEL_MAX_WIDTH := 680.0             # .menu-panel width: min(680px, 92vw)
const PANEL_VIEWPORT_SHARE := 0.92
const PANEL_BACKGROUND := Color(10.0 / 255.0, 12.0 / 255.0, 17.0 / 255.0, 0.72)
const PANEL_PADDING := Vector2(40.0, 32.0) # padding: 32px 40px
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
const PLAY_TEXT := "PLAY"                  # web en menuPlay
const APPEARANCE_TEXT := "APPEARANCE"      # menuAppearance
const SETTINGS_TEXT := "SETTINGS"          # menuSettings
const ABOUT_TEXT := "ABOUT"                # settingsSecAbout
const QUIT_TEXT := "QUIT"                  # menuExit
const HINT_TEXT := "F11 — fullscreen"      # menuFullscreenHint (browser only)
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
const ARENA := "res://scenes/arena_test.tscn"
const LOGS_DIR := "user://logs"
const HALF := 0.5

var _panel: Panel
var _column: CssColumn
var _lobby: LobbyScreen
var _buttons: Array[UiButton] = []
var _quit: UiButton
var _hint: Label
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
	_panel = Panel.new()
	_panel.name = "Panel"
	_panel.add_theme_stylebox_override("panel", _panel_box())
	add_child(_panel)
	_column = CssColumn.new()
	_column.name = "Column"
	_panel.add_child(_column)
	_add_logo()
	var rule := ColorRect.new()
	rule.name = "Rule"
	rule.color = UiTokens.LINE
	rule.custom_minimum_size = RULE_SIZE
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_column.add(rule, 0.0, RULE_MARGIN_BOTTOM)
	_add_button("Play", PLAY_TEXT, UiButton.PRIMARY).pressed.connect(_on_play)
	_add_button("Appearance", APPEARANCE_TEXT, UiButton.SECONDARY).pressed.connect(
		screen_requested.emit.bind(SCREEN_APPEARANCE))
	_add_button("Settings", SETTINGS_TEXT, UiButton.SECONDARY).pressed.connect(screen_requested.emit.bind(SCREEN_SETTINGS))
	_add_button("About", ABOUT_TEXT, UiButton.SECONDARY).pressed.connect(screen_requested.emit.bind(SCREEN_ABOUT))
	_quit = _add_button("Quit", QUIT_TEXT, UiButton.GHOST)   # web: desktop only — this build always is one
	_quit.pressed.connect(_on_quit)
	_hint = _small_label("Hint", HINT_TEXT)
	_hint.visible = false
	_column.add(_hint, HINT_MARGIN_TOP)
	_version = _version_chip()
	add_child(_version)
	resized.connect(_layout)
	_version.minimum_size_changed.connect(_layout)
	_layout()
	Audio.play_menu_music()   # web App: menu music on every non-match screen

## PLAY (web handlePlay): a fresh local room on every visit, shown in the same panel instead of the menu.
func open_lobby() -> void:
	close_lobby()
	var room := RoomModel.new(Game.profile, Game.random.randf)
	_lobby = LobbyScreen.new()
	_lobby.name = "Lobby"
	_lobby.setup(room, Game.random.randf)
	_panel.add_child(_lobby)
	_lobby.back_requested.connect(close_lobby)
	_lobby.match_requested.connect(_start_match)
	_column.visible = false
	_layout()

## BACK / LEAVE: the room closes, the menu returns.
func close_lobby() -> void:
	if _lobby != null:
		_lobby.queue_free()
		_lobby = null
	_column.visible = true

func lobby() -> LobbyScreen:
	return _lobby

## The browser build's layout (parity captures): the F11 hint instead of QUIT.
func set_browser_layout(browser: bool) -> void:
	_hint.visible = browser
	_quit.visible = not browser

func _layout() -> void:
	var width := minf(PANEL_MAX_WIDTH, size.x * PANEL_VIEWPORT_SHARE)
	_panel.position = Vector2(CssPixel.snap((size.x - width) * HALF), 0.0)
	_panel.size = Vector2(width, size.y)
	var inset := PANEL_PADDING + Vector2(PANEL_BORDER_PX, 0.0)
	_column.position = inset
	_column.size = _panel.size - inset * 2.0
	if _lobby != null:
		_lobby.position = inset
		_lobby.size = _column.size + Vector2(LobbyScreen.BLEED, 0.0)
	for button in _buttons:
		button.custom_minimum_size.x = _column.size.x * BUTTON_SHARE
	var chip := _version.get_combined_minimum_size()
	_version.size = chip
	_version.position = size - chip - Vector2(VERSION_RIGHT, VERSION_BOTTOM)

func _panel_box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = PANEL_BACKGROUND
	box.border_color = UiTokens.SURFACE_LINE
	box.border_width_left = PANEL_BORDER_PX
	box.border_width_right = PANEL_BORDER_PX
	box.anti_aliasing = false
	return box

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
