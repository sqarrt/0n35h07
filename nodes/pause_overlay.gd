class_name PauseOverlay extends CanvasLayer
## Pause menu — port of web PauseMenu with the App pause rules (PauseModel): it shows while a live match has no pointer
## lock and never stops the match. MENU over RESUME (primary, no UI sounds; after the lock is lost it waits out the
## cooldown with its fill growing left to right), SETTINGS, TO MENU and, on the desktop build, QUIT (ghost). Esc and a
## lost window focus release the lock like the browser does.

signal settings_requested                # web pause settings sub-view (MatchSettings)

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
const COOLDOWN_OPACITY := 0.5            # web inline opacity while RESUME waits
const MAIN_MENU := "res://scenes/main_menu.tscn"

var _model := PauseModel.new()
var _live: Callable = func() -> bool: return false   # no match wired: nothing to pause
var _lock := PointerLock.new()
var _now_ms: Callable = func() -> float: return float(Time.get_ticks_msec())
var _resume: UiButton
var _quit: UiButton

## The live-phase check (MatchNode.is_live); the lock and the clock are injectable for tests.
func setup(live: Callable, lock: PointerLock = null, now_ms := Callable()) -> void:
	_live = live
	if lock != null:
		_lock = lock
	if now_ms.is_valid():
		_now_ms = now_ms

func _ready() -> void:
	layer = LAYER
	process_mode = Node.PROCESS_MODE_ALWAYS
	var backdrop := ColorRect.new()
	backdrop.name = "Backdrop"
	backdrop.color = BACKDROP
	add_child(backdrop)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var column := CssColumn.new()
	column.name = "Column"
	add_child(column)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var title := Label.new()
	title.name = "Title"
	title.text = I18n.t(TITLE_KEY)
	var title_font := UiFont.with_css_line(UiFont.bold_spaced(TITLE_SPACING_EM, TITLE_FONT_SIZE), TITLE_FONT_SIZE)
	title.add_theme_font_override("font", title_font)
	title.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(title_font))
	title.add_theme_font_size_override("font_size", TITLE_FONT_SIZE)
	title.add_theme_color_override("font_color", UiTokens.ACCENT)
	column.add(title, 0.0, TITLE_MARGIN_BOTTOM)
	_resume = UiButton.new(I18n.t(RESUME_KEY), UiButton.PRIMARY, false)   # web: a plain <button>, silent
	_resume.name = "Resume"
	_resume.disabled_opacity = COOLDOWN_OPACITY
	_resume.pressed.connect(_on_resume)
	column.add(_resume.grouped(), UiButton.MARGIN_Y, UiButton.MARGIN_Y)   # the dark label over the faded fill
	_button(column, "Settings", I18n.t(SETTINGS_KEY), UiButton.GHOST).pressed.connect(settings_requested.emit)
	_button(column, "ToMenu", I18n.t(TO_MENU_KEY), UiButton.GHOST).pressed.connect(_on_main_menu)
	_quit = _button(column, "Quit", I18n.t(QUIT_KEY), UiButton.GHOST)
	_quit.pressed.connect(_on_quit)
	visible = false
	refresh()

## QUIT shows on the desktop build only (web IS_DESKTOP); this build is always a desktop one.
func set_quit_visible(shown: bool) -> void:
	_quit.visible = shown

func _process(_delta: float) -> void:
	refresh()

## Re-read the lock and the phase: show or hide, and the RESUME cooldown.
func refresh() -> void:
	var now: float = _now_ms.call()
	_model.set_locked(_lock.is_locked(), now)
	visible = _model.is_paused(_live.call())
	if not visible:
		return
	_resume.set_cooldown_share(_model.cooldown_share(now))
	_resume.set_enabled(_model.can_resume(now))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_lock.release()                    # the browser leaves the pointer lock on Esc

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_lock.release()                    # alt-tab loses the pointer lock too

func _button(column: CssColumn, node_name: String, label: String, variant: String, sounds := true) -> UiButton:
	var button := UiButton.new(label, variant, sounds)
	button.name = node_name
	column.add(button, UiButton.MARGIN_Y, UiButton.MARGIN_Y)
	return button

func _on_resume() -> void:
	if _model.can_resume(_now_ms.call()):
		_lock.lock()
		refresh()

func _on_main_menu() -> void:
	get_tree().change_scene_to_file(MAIN_MENU)

func _on_quit() -> void:
	get_tree().quit()
