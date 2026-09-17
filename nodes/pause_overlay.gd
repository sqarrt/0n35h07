class_name PauseOverlay extends CanvasLayer
## Pause menu — port of web PauseMenu with the App pause rules (PauseModel): it shows while a live match has no pointer
## lock and never stops the match. MENU over RESUME (primary, no UI sounds), SETTINGS (the in-match settings panel in
## place of the menu, back to the menu whenever the pause closes), TO MENU and, on the desktop build, QUIT (ghost).
## A lost window focus releases the lock like the browser does, and Esc both pauses and unpauses — web could only pause
## with it, because Chrome takes the pointer lock away on that key and refuses to give it back to the same press.

signal profile_changed(profile: Dictionary)   # a setting changed in the in-match panel

const LAYER := 10
const BACKDROP := Color(10.0 / 255.0, 10.0 / 255.0, 15.0 / 255.0, 0.85)   # web rgba(10,10,15,0.85)
const TITLE_KEY := "pauseTitle"         # web dictionary keys
const RESUME_KEY := "pauseResume"
const SETTINGS_KEY := "settingsTitle"
const TO_MENU_KEY := "pauseToMenu"
const QUIT_KEY := "pauseExit"
const TITLE_FONT_SIZE := 24              # h2: 1.5em, bold
const TITLE_SPACING_EM := 0.2
const TITLE_MARGIN_BOTTOM := 32.0        # 2rem
const MAIN_MENU := "res://scenes/main_menu.tscn"

var profile := {}                        # the live profile the in-match settings edit (arena_boot: Game.profile)

var _model := PauseModel.new()
var _column: CssColumn
var _settings: MatchSettings
var _desktop := true
var _live: Callable = func() -> bool: return false   # no match wired: nothing to pause
var _lock := PointerLock.new()
var _resume: UiButton
var _quit: UiButton

## The live-phase check (MatchNode.is_live); the lock is injectable for tests.
func setup(live: Callable, lock: PointerLock = null) -> void:
	_live = live
	if lock != null:
		_lock = lock

func _ready() -> void:
	layer = LAYER
	process_mode = Node.PROCESS_MODE_ALWAYS
	var backdrop := ColorRect.new()
	backdrop.name = "Backdrop"
	backdrop.color = BACKDROP
	add_child(backdrop)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_column = CssColumn.new()
	_column.name = "Column"
	add_child(_column)
	_column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var title := MenuText.label("Title", I18n.t(TITLE_KEY), TITLE_FONT_SIZE, TITLE_SPACING_EM, UiTokens.ACCENT, true)
	_column.add(title, 0.0, TITLE_MARGIN_BOTTOM)
	_resume = UiButton.new(I18n.t(RESUME_KEY), UiButton.PRIMARY, false)   # web: a plain <button>, silent
	_resume.name = "Resume"
	_resume.pressed.connect(_on_resume)
	_column.add(_resume.grouped(), UiButton.MARGIN_Y, UiButton.MARGIN_Y)   # the dark label over the faded fill
	_button("Settings", I18n.t(SETTINGS_KEY), UiButton.GHOST).pressed.connect(open_settings)
	_button("ToMenu", I18n.t(TO_MENU_KEY), UiButton.GHOST).pressed.connect(_on_main_menu)
	_quit = _button("Quit", I18n.t(QUIT_KEY), UiButton.GHOST)
	_quit.pressed.connect(_on_quit)
	visible = false
	refresh()

## QUIT and the in-match radio slider show on the desktop build only (web IS_DESKTOP); this build always is one, the
## browser layout is for parity captures.
func set_desktop(desktop: bool) -> void:
	_desktop = desktop
	_quit.visible = desktop
	if _settings != null:
		_settings.set_radio_visible(desktop)

## SETTINGS (web setPauseView('settings')): the in-match panel replaces the menu.
func open_settings() -> void:
	if _settings != null:
		return
	_settings = MatchSettings.new()
	_settings.name = "MatchSettings"
	_settings.setup(profile)
	_settings.set_radio_visible(_desktop)
	_settings.back_requested.connect(close_settings)
	_settings.profile_changed.connect(profile_changed.emit)
	add_child(_settings)
	_column.visible = false

## BACK, or the pause closing (web resets pauseView to the menu): the menu returns.
func close_settings() -> void:
	if _settings == null:
		return
	remove_child(_settings)
	_settings.queue_free()
	_settings = null
	_column.visible = true

func settings() -> MatchSettings:
	return _settings

func _process(_delta: float) -> void:
	refresh()

## Re-read the lock and the phase: show or hide.
func refresh() -> void:
	_model.set_locked(_lock.is_locked())
	visible = _model.is_paused(_live.call())
	if not visible:
		close_settings()

func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("pause"):
		return
	if not visible:
		_lock.release()                    # the browser leaves the pointer lock on Esc
		return
	if _settings != null:                  # the in-match settings step back to the pause menu first
		close_settings()
		return
	_on_resume()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_lock.release()                    # alt-tab loses the pointer lock too

func _button(node_name: String, label: String, variant: String, sounds := true) -> UiButton:
	var button := UiButton.new(label, variant, sounds)
	button.name = node_name
	_column.add(button, UiButton.MARGIN_Y, UiButton.MARGIN_Y)
	return button

func _on_resume() -> void:
	_lock.lock()
	refresh()

func _on_main_menu() -> void:
	get_tree().change_scene_to_file(MAIN_MENU)

func _on_quit() -> void:
	get_tree().quit()
